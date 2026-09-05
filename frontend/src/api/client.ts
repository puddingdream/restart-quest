import {
  NEXT_REQUIRED_ACTIONS,
  type ActionInput,
  type ActionResponse,
  type ActionStatus,
  type AdaptationSuggestion,
  type Attempt,
  type AttemptOutcome,
  type AttemptRequest,
  type AttemptResponse,
  type BlockerCode,
  type BootstrapResponse,
  type CreateQuestRequest,
  type CreateQuestResponse,
  type FieldError,
  type HistoryEntry,
  type HistoryResponse,
  type NextRequiredAction,
  type PendingAdaptation,
  type ProblemDetails,
  type Quest,
  type QuestAction,
  type QuestResponse,
  type QuestStatus,
  type SessionResponse,
  type VersionRequest,
  type Workspace,
} from './contracts';

type JsonObject = Record<string, unknown>;
type Parser<T> = (value: unknown) => T;

export interface MutationResult<T> {
  data: T;
  idempotencyKey: string;
  replayed: boolean;
}

export interface PreparedMutation<T> {
  idempotencyKey: string;
  execute: () => Promise<MutationResult<T>>;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  uuid?: () => string;
}

export class ApiProblemError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
    this.name = 'ApiProblemError';
  }

  get status() {
    return this.problem.status;
  }
}

export class ApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiContractError';
  }
}

export class ApiTransportError extends Error {
  constructor(readonly cause: unknown) {
    super('서버에 연결할 수 없습니다.');
    this.name = 'ApiTransportError';
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly uuid: () => string;
  private csrfToken: string | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetchImpl = options.fetch ?? fetch;
    this.uuid = options.uuid ?? (() => crypto.randomUUID());
  }

  async createSession(timezone: string): Promise<SessionResponse> {
    const response = await this.request('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone }),
    });
    const session = await parseSuccess(response, parseSession);
    this.csrfToken = session.csrfToken;
    return session;
  }

  async getBootstrap(): Promise<BootstrapResponse> {
    const response = await this.request('/bootstrap');
    const bootstrap = await parseSuccess(response, parseBootstrap);
    this.csrfToken = bootstrap.csrfToken;
    return bootstrap;
  }

  async getHistory(cursor?: string, size = 20): Promise<HistoryResponse> {
    const query = new URLSearchParams({ size: String(size) });
    if (cursor) query.set('cursor', cursor);
    return parseSuccess(await this.request(`/history?${query}`), parseHistoryResponse);
  }

  clearSession(): void {
    this.csrfToken = null;
  }

  prepareCreateQuest(input: CreateQuestRequest): PreparedMutation<CreateQuestResponse> {
    return this.prepareJsonWrite('POST', '/quests', input, parseCreateQuestResponse);
  }

  prepareCreateAction(questId: string, input: ActionInput): PreparedMutation<ActionResponse> {
    return this.prepareJsonWrite(
      'POST',
      `/quests/${encodeURIComponent(questId)}/actions`,
      input,
      parseActionResponse,
    );
  }

  prepareRecordAttempt(actionId: string, input: AttemptRequest): PreparedMutation<AttemptResponse> {
    return this.prepareJsonWrite(
      'POST',
      `/actions/${encodeURIComponent(actionId)}/attempts`,
      input,
      parseAttemptResponse,
    );
  }

  prepareAdaptation(attemptId: string, input: ActionInput): PreparedMutation<ActionResponse> {
    return this.prepareJsonWrite(
      'POST',
      `/attempts/${encodeURIComponent(attemptId)}/adaptation`,
      input,
      parseActionResponse,
    );
  }

  prepareCompleteQuest(questId: string, input: VersionRequest): PreparedMutation<QuestResponse> {
    return this.prepareJsonWrite(
      'POST',
      `/quests/${encodeURIComponent(questId)}/complete`,
      input,
      parseQuestResponse,
    );
  }

  prepareArchiveQuest(questId: string, input: VersionRequest): PreparedMutation<QuestResponse> {
    return this.prepareJsonWrite(
      'POST',
      `/quests/${encodeURIComponent(questId)}/archive`,
      input,
      parseQuestResponse,
    );
  }

  prepareDeleteWorkspace(): PreparedMutation<void> {
    return this.prepareWrite('DELETE', '/workspace', undefined, parseEmpty, {
      'X-Confirm-Delete': 'delete-my-data',
    });
  }

  private prepareJsonWrite<T>(method: string, path: string, body: unknown, parser: Parser<T>): PreparedMutation<T> {
    return this.prepareWrite(method, path, JSON.stringify(body), parser, {
      'Content-Type': 'application/json',
    });
  }

  private prepareWrite<T>(
    method: string,
    path: string,
    body: string | undefined,
    parser: Parser<T>,
    extraHeaders: Record<string, string>,
  ): PreparedMutation<T> {
    const idempotencyKey = this.uuid();
    assertUuid(idempotencyKey);

    return {
      idempotencyKey,
      execute: async () => {
        if (!this.csrfToken) {
          throw new ApiContractError('bootstrap 이후에만 상태 변경 요청을 보낼 수 있습니다.');
        }
        const response = await this.request(path, {
          method,
          headers: {
            ...extraHeaders,
            'X-CSRF-Token': this.csrfToken,
            'Idempotency-Key': idempotencyKey,
          },
          body,
        });
        return {
          data: await parseSuccess(response, parser),
          idempotencyKey,
          replayed: response.headers.get('Idempotency-Replayed') === 'true',
        };
      },
    };
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        credentials: 'same-origin',
        ...init,
      });
    } catch (error) {
      if (error instanceof ApiContractError) throw error;
      throw new ApiTransportError(error);
    }
  }
}

async function parseSuccess<T>(response: Response, parser: Parser<T>): Promise<T> {
  if (!response.ok) throw new ApiProblemError(await parseProblem(response));
  if (response.status === 204) return parser(undefined);

  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    throw new ApiContractError(`JSON 응답을 읽을 수 없습니다: ${error instanceof Error ? error.message : 'unknown'}`);
  }
  return parser(value);
}

async function parseProblem(response: Response): Promise<ProblemDetails> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    return {
      type: 'about:blank',
      title: '요청을 완료하지 못했습니다.',
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
      detail: '서버 오류 응답을 읽을 수 없습니다.',
      fieldErrors: [],
    };
  }

  const object = asObject(value, 'problem');
  const fields = object.fieldErrors === undefined
    ? []
    : asArray(object.fieldErrors, 'problem.fieldErrors').map(parseFieldError);
  return {
    type: asString(object.type, 'problem.type'),
    title: asString(object.title, 'problem.title'),
    status: asNumber(object.status, 'problem.status'),
    code: asString(object.code, 'problem.code'),
    detail: asString(object.detail, 'problem.detail'),
    fieldErrors: fields,
    ...(object.traceId === undefined ? {} : { traceId: asString(object.traceId, 'problem.traceId') }),
  };
}

function parseSession(value: unknown): SessionResponse {
  const object = asObject(value, 'session');
  return {
    csrfToken: asString(object.csrfToken, 'session.csrfToken'),
    workspaceExpiresAt: asString(object.workspaceExpiresAt, 'session.workspaceExpiresAt'),
  };
}

function parseBootstrap(value: unknown): BootstrapResponse {
  const object = asObject(value, 'bootstrap');
  return {
    workspace: parseWorkspace(object.workspace),
    activeQuest: parseNullable(object.activeQuest, parseQuest),
    currentAction: parseNullable(object.currentAction, parseAction),
    pendingAdaptation: parseNullable(object.pendingAdaptation, parsePendingAdaptation),
    recentAttempts: asArray(object.recentAttempts, 'bootstrap.recentAttempts').map(parseHistoryEntry),
    nextRequiredAction: parseNextRequiredAction(object.nextRequiredAction),
    csrfToken: asString(object.csrfToken, 'bootstrap.csrfToken'),
    workspaceExpiresAt: asString(object.workspaceExpiresAt, 'bootstrap.workspaceExpiresAt'),
  };
}

function parseHistoryResponse(value: unknown): HistoryResponse {
  const object = asObject(value, 'history');
  return {
    items: asArray(object.items, 'history.items').map(parseHistoryEntry),
    nextCursor: parseNullable(object.nextCursor, (cursor) => asString(cursor, 'history.nextCursor')),
  };
}

function parseCreateQuestResponse(value: unknown): CreateQuestResponse {
  const object = asObject(value, 'createQuest');
  return {
    quest: parseQuest(object.quest),
    action: parseAction(object.action),
    nextRequiredAction: parseNextRequiredAction(object.nextRequiredAction),
  };
}

function parseActionResponse(value: unknown): ActionResponse {
  const object = asObject(value, 'actionResponse');
  return {
    action: parseAction(object.action),
    nextRequiredAction: parseNextRequiredAction(object.nextRequiredAction),
  };
}

function parseAttemptResponse(value: unknown): AttemptResponse {
  const object = asObject(value, 'attemptResponse');
  return {
    attempt: parseAttempt(object.attempt),
    nextRequiredAction: parseNextRequiredAction(object.nextRequiredAction),
    ...(object.suggestion === undefined ? {} : { suggestion: parseSuggestion(object.suggestion) }),
  };
}

function parseQuestResponse(value: unknown): QuestResponse {
  const object = asObject(value, 'questResponse');
  return {
    quest: parseQuest(object.quest),
    nextRequiredAction: parseNextRequiredAction(object.nextRequiredAction),
  };
}

function parseWorkspace(value: unknown): Workspace {
  const object = asObject(value, 'workspace');
  return {
    id: asString(object.id, 'workspace.id'),
    timezone: asString(object.timezone, 'workspace.timezone'),
  };
}

function parseQuest(value: unknown): Quest {
  const object = asObject(value, 'quest');
  return {
    id: asString(object.id, 'quest.id'),
    status: asEnum(object.status, ['ACTIVE', 'COMPLETED', 'ARCHIVED'] as const, 'quest.status') as QuestStatus,
    title: asString(object.title, 'quest.title'),
    version: asNumber(object.version, 'quest.version'),
    createdAt: asString(object.createdAt, 'quest.createdAt'),
    ...(object.completedAt === undefined ? {} : { completedAt: asString(object.completedAt, 'quest.completedAt') }),
    ...(object.archivedAt === undefined ? {} : { archivedAt: asString(object.archivedAt, 'quest.archivedAt') }),
  };
}

function parseAction(value: unknown): QuestAction {
  const object = asObject(value, 'action');
  return {
    id: asString(object.id, 'action.id'),
    questId: asString(object.questId, 'action.questId'),
    status: asEnum(object.status, ['READY', 'DONE', 'BLOCKED', 'CANCELLED'] as const, 'action.status') as ActionStatus,
    title: asString(object.title, 'action.title'),
    estimatedMinutes: asNumber(object.estimatedMinutes, 'action.estimatedMinutes'),
    createdAt: asString(object.createdAt, 'action.createdAt'),
    ...(object.sourceAttemptId === undefined
      ? {}
      : { sourceAttemptId: asString(object.sourceAttemptId, 'action.sourceAttemptId') }),
    ...(object.endedAt === undefined ? {} : { endedAt: asString(object.endedAt, 'action.endedAt') }),
  };
}

function parseAttempt(value: unknown): Attempt {
  const object = asObject(value, 'attempt');
  return {
    id: asString(object.id, 'attempt.id'),
    actionId: asString(object.actionId, 'attempt.actionId'),
    outcome: asEnum(object.outcome, ['DONE', 'BLOCKED'] as const, 'attempt.outcome') as AttemptOutcome,
    createdAt: asString(object.createdAt, 'attempt.createdAt'),
    ...(object.blockerCode === undefined
      ? {}
      : { blockerCode: asEnum(object.blockerCode, ['TOO_BIG', 'LOW_ENERGY', 'UNCLEAR', 'NO_TIME', 'OTHER'] as const, 'attempt.blockerCode') as BlockerCode }),
    ...(object.note === undefined ? {} : { note: asString(object.note, 'attempt.note') }),
  };
}

function parseSuggestion(value: unknown): AdaptationSuggestion {
  const object = asObject(value, 'suggestion');
  return {
    strategyCode: asString(object.strategyCode, 'suggestion.strategyCode'),
    guidance: asString(object.guidance, 'suggestion.guidance'),
    title: asString(object.title, 'suggestion.title'),
    estimatedMinutes: asNumber(object.estimatedMinutes, 'suggestion.estimatedMinutes'),
  };
}

function parsePendingAdaptation(value: unknown): PendingAdaptation {
  const object = asObject(value, 'pendingAdaptation');
  return {
    attempt: parseAttempt(object.attempt),
    suggestion: parseSuggestion(object.suggestion),
  };
}

function parseHistoryEntry(value: unknown): HistoryEntry {
  const object = asObject(value, 'historyEntry');
  return {
    attempt: parseAttempt(object.attempt),
    action: parseAction(object.action),
    ...(object.successorAction === undefined ? {} : { successorAction: parseAction(object.successorAction) }),
  };
}

function parseFieldError(value: unknown): FieldError {
  const object = asObject(value, 'fieldError');
  return {
    field: asString(object.field, 'fieldError.field'),
    reason: asString(object.reason, 'fieldError.reason'),
  };
}

function parseNextRequiredAction(value: unknown): NextRequiredAction {
  return asEnum(value, NEXT_REQUIRED_ACTIONS, 'nextRequiredAction');
}

function parseEmpty(value: unknown): void {
  if (value !== undefined) throw new ApiContractError('204 응답에 본문이 포함되어 있습니다.');
}

function parseNullable<T>(value: unknown, parser: Parser<T>): T | null {
  return value === null ? null : parser(value);
}

function asObject(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ApiContractError(`${path}는 object여야 합니다.`);
  }
  return value as JsonObject;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ApiContractError(`${path}는 array여야 합니다.`);
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new ApiContractError(`${path}는 string이어야 합니다.`);
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiContractError(`${path}는 유한한 number여야 합니다.`);
  }
  return value;
}

function asEnum<const T extends readonly string[]>(value: unknown, values: T, path: string): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new ApiContractError(`${path}에 알 수 없는 값이 있습니다.`);
  }
  return value as T[number];
}

function assertUuid(value: string): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(value)) throw new ApiContractError('idempotency key는 UUID여야 합니다.');
}
