import {
  ApiClient,
  ApiProblemError,
  ApiTransportError,
  type ActionResponse,
  type AttemptResponse,
  type BootstrapResponse,
  type CreateQuestRequest,
  type CreateQuestResponse,
  type MutationResult,
  type NextRequiredAction,
  type PreparedMutation,
  type QuestResponse,
} from '../api';

export type QuestCommand =
  | { kind: 'CREATE_QUEST'; input: CreateQuestRequest }
  | { kind: 'CREATE_ACTION'; questId: string; input: { title: string; estimatedMinutes: number } }
  | { kind: 'RECORD_ATTEMPT'; actionId: string; input: { outcome: 'DONE' | 'BLOCKED'; blockerCode?: 'TOO_BIG' | 'LOW_ENERGY' | 'UNCLEAR' | 'NO_TIME' | 'OTHER'; note?: string } }
  | { kind: 'ADAPT_ACTION'; attemptId: string; input: { title: string; estimatedMinutes: number } }
  | { kind: 'COMPLETE_QUEST'; questId: string; input: { version: number } }
  | { kind: 'ARCHIVE_QUEST'; questId: string; input: { version: number } }
  | { kind: 'DELETE_WORKSPACE' };

export type RecoveryReason =
  | 'VALIDATION'
  | 'SESSION_RECREATED'
  | 'STALE_STATE'
  | 'WORKSPACE_ACCESS_UNAVAILABLE'
  | 'OFFLINE'
  | 'SERVER_ERROR';

export const COMPLETED_TITLE_STORAGE_KEY = 'restart-quest.completed-title';

export interface WorkspaceSessionStorage {
  removeItem(key: string): void;
}

type CommandResponse = CreateQuestResponse | ActionResponse | AttemptResponse | QuestResponse | void;

export interface RetainedSubmission {
  command: QuestCommand;
  idempotencyKey: string;
  retryable: boolean;
}

export interface QuestFlowState {
  phase: 'idle' | 'loading' | 'ready' | 'submitting' | 'error' | 'workspace-access-unavailable' | 'deleted';
  bootstrap: BootstrapResponse | null;
  nextRequiredAction: NextRequiredAction | null;
  retainedSubmission: RetainedSubmission | null;
  fieldErrors: Record<string, string[]>;
  recoveryReason: RecoveryReason | null;
  lastMutationReplayed: boolean;
}

const INITIAL_STATE: QuestFlowState = {
  phase: 'idle',
  bootstrap: null,
  nextRequiredAction: null,
  retainedSubmission: null,
  fieldErrors: {},
  recoveryReason: null,
  lastMutationReplayed: false,
};

export class QuestFlowController {
  private state: QuestFlowState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private bootstrapInFlight: Promise<void> | null = null;
  private mutationInFlight: Promise<void> | null = null;
  private retryMutation: PreparedMutation<CommandResponse> | null = null;

  constructor(
    private readonly api: ApiClient,
    private readonly timezone: string,
    private readonly sessionStorage: WorkspaceSessionStorage | null = resolveSessionStorage(),
  ) {}

  getSnapshot = (): QuestFlowState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  initialize(): Promise<void> {
    if (this.bootstrapInFlight) return this.bootstrapInFlight;
    this.setState({ ...this.state, phase: 'loading', recoveryReason: null });
    const pending = this.loadBootstrap(true)
      .then(() => undefined)
      .catch((error: unknown) => this.setBootstrapFailure(error))
      .finally(() => {
        this.bootstrapInFlight = null;
      });
    this.bootstrapInFlight = pending;
    return pending;
  }

  startNewWorkspace(): Promise<void> {
    if (this.bootstrapInFlight) return this.bootstrapInFlight;

    this.clearWorkspaceData();
    this.setState({ ...INITIAL_STATE, phase: 'loading' });
    const pending = this.api.createSession(this.timezone)
      .then(() => this.loadBootstrap(false))
      .then(() => undefined)
      .catch((error: unknown) => this.setBootstrapFailure(error))
      .finally(() => {
        this.bootstrapInFlight = null;
      });
    this.bootstrapInFlight = pending;
    return pending;
  }

  submit(command: QuestCommand): Promise<void> {
    if (this.mutationInFlight) return this.mutationInFlight;

    const commandSnapshot = cloneCommand(command);
    const prepared = this.prepare(commandSnapshot);
    this.retryMutation = prepared;
    this.setState({
      ...this.state,
      phase: 'submitting',
      retainedSubmission: {
        command: commandSnapshot,
        idempotencyKey: prepared.idempotencyKey,
        retryable: false,
      },
      fieldErrors: {},
      recoveryReason: null,
      lastMutationReplayed: false,
    });
    return this.runMutation(prepared, commandSnapshot);
  }

  retry(): Promise<void> {
    const retained = this.state.retainedSubmission;
    if (this.mutationInFlight) return this.mutationInFlight;
    if (!retained?.retryable || !this.retryMutation) return Promise.resolve();
    this.setState({ ...this.state, phase: 'submitting', recoveryReason: null });
    return this.runMutation(this.retryMutation, retained.command);
  }

  private runMutation(prepared: PreparedMutation<CommandResponse>, command: QuestCommand): Promise<void> {
    this.mutationInFlight = prepared.execute()
      .then((result) => this.setMutationSuccess(result, command))
      .catch((error: unknown) => this.handleMutationFailure(error, prepared, command))
      .finally(() => {
        this.mutationInFlight = null;
      });
    return this.mutationInFlight;
  }

  private async handleMutationFailure(
    error: unknown,
    prepared: PreparedMutation<CommandResponse>,
    command: QuestCommand,
  ): Promise<void> {
    const retained = (retryable: boolean): RetainedSubmission => ({
      command,
      idempotencyKey: prepared.idempotencyKey,
      retryable,
    });

    if (error instanceof ApiProblemError && error.status === 400) {
      this.retryMutation = null;
      this.setState({
        ...this.state,
        phase: 'ready',
        retainedSubmission: retained(false),
        fieldErrors: groupFieldErrors(error.problem.fieldErrors),
        recoveryReason: 'VALIDATION',
      });
      return;
    }

    if (isWorkspaceAccessUnavailable(error)) {
      this.enterWorkspaceAccessUnavailable();
      return;
    }

    if (isSessionRequired(error)) {
      this.retryMutation = null;
      await this.recoverAfterWrite(retained(false), 'SESSION_RECREATED', true);
      return;
    }

    if (error instanceof ApiProblemError && error.status === 409) {
      this.retryMutation = null;
      await this.recoverAfterWrite(retained(false), 'STALE_STATE', false);
      return;
    }

    const reason: RecoveryReason = error instanceof ApiTransportError ? 'OFFLINE' : 'SERVER_ERROR';
    this.setState({
      ...this.state,
      phase: 'error',
      retainedSubmission: retained(true),
      recoveryReason: reason,
    });
  }

  private async recoverAfterWrite(
    retainedSubmission: RetainedSubmission,
    recoveryReason: RecoveryReason,
    recreateSession: boolean,
  ): Promise<void> {
    try {
      if (recreateSession) await this.api.createSession(this.timezone);
      const bootstrap = await this.loadBootstrap(!recreateSession);
      this.setState({
        ...this.state,
        phase: 'ready',
        bootstrap,
        nextRequiredAction: bootstrap.nextRequiredAction,
        retainedSubmission,
        fieldErrors: {},
        recoveryReason,
      });
    } catch (recoveryError) {
      if (isWorkspaceAccessUnavailable(recoveryError)) {
        this.enterWorkspaceAccessUnavailable();
        return;
      }
      const reason: RecoveryReason = recoveryError instanceof ApiTransportError ? 'OFFLINE' : 'SERVER_ERROR';
      this.setState({
        ...this.state,
        phase: 'error',
        retainedSubmission,
        recoveryReason: reason,
      });
    }
  }

  private async loadBootstrap(recreateOnUnauthorized: boolean): Promise<BootstrapResponse> {
    try {
      const bootstrap = await this.api.getBootstrap();
      this.setBootstrapSuccess(bootstrap);
      return bootstrap;
    } catch (error) {
      if (!recreateOnUnauthorized || !isSessionRequired(error)) throw error;
      await this.api.createSession(this.timezone);
      const bootstrap = await this.api.getBootstrap();
      this.setBootstrapSuccess(bootstrap);
      return bootstrap;
    }
  }

  private setBootstrapSuccess(bootstrap: BootstrapResponse): void {
    this.setState({
      ...this.state,
      phase: 'ready',
      bootstrap,
      nextRequiredAction: bootstrap.nextRequiredAction,
      fieldErrors: {},
    });
  }

  private setBootstrapFailure(error: unknown): void {
    if (isWorkspaceAccessUnavailable(error)) {
      this.enterWorkspaceAccessUnavailable();
      return;
    }
    this.setState({
      ...this.state,
      phase: 'error',
      recoveryReason: error instanceof ApiTransportError ? 'OFFLINE' : 'SERVER_ERROR',
    });
  }

  private setMutationSuccess(result: MutationResult<CommandResponse>, command: QuestCommand): void {
    if (command.kind === 'DELETE_WORKSPACE') {
      this.clearWorkspaceData();
      this.setState({ ...INITIAL_STATE, phase: 'deleted' });
      return;
    }

    const data = result.data;
    this.retryMutation = null;
    this.setState({
      ...this.state,
      phase: 'ready',
      nextRequiredAction: data === undefined ? null : data.nextRequiredAction,
      retainedSubmission: null,
      fieldErrors: {},
      recoveryReason: null,
      lastMutationReplayed: result.replayed,
    });
  }

  private prepare(command: QuestCommand): PreparedMutation<CommandResponse> {
    switch (command.kind) {
      case 'CREATE_QUEST':
        return this.api.prepareCreateQuest(command.input);
      case 'CREATE_ACTION':
        return this.api.prepareCreateAction(command.questId, command.input);
      case 'RECORD_ATTEMPT':
        return this.api.prepareRecordAttempt(command.actionId, command.input);
      case 'ADAPT_ACTION':
        return this.api.prepareAdaptation(command.attemptId, command.input);
      case 'COMPLETE_QUEST':
        return this.api.prepareCompleteQuest(command.questId, command.input);
      case 'ARCHIVE_QUEST':
        return this.api.prepareArchiveQuest(command.questId, command.input);
      case 'DELETE_WORKSPACE':
        return this.api.prepareDeleteWorkspace();
    }
  }

  private setState(next: QuestFlowState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  private enterWorkspaceAccessUnavailable(): void {
    this.clearWorkspaceData();
    this.setState({
      ...INITIAL_STATE,
      phase: 'workspace-access-unavailable',
      recoveryReason: 'WORKSPACE_ACCESS_UNAVAILABLE',
    });
  }

  private clearWorkspaceData(): void {
    this.retryMutation = null;
    this.api.clearSession();
    try {
      this.sessionStorage?.removeItem(COMPLETED_TITLE_STORAGE_KEY);
    } catch {
      // 접근할 수 없는 storage에는 이 세션에서 재노출할 수 있는 값도 없습니다.
    }
  }
}

function isSessionRequired(error: unknown): error is ApiProblemError {
  return error instanceof ApiProblemError && error.status === 401 && error.problem.code === 'SESSION_REQUIRED';
}

function isWorkspaceAccessUnavailable(error: unknown): error is ApiProblemError {
  return error instanceof ApiProblemError
    && error.status === 401
    && error.problem.code === 'WORKSPACE_ACCESS_UNAVAILABLE';
}

function resolveSessionStorage(): WorkspaceSessionStorage | null {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function groupFieldErrors(errors: Array<{ field: string; reason: string }>): Record<string, string[]> {
  return errors.reduce<Record<string, string[]>>((grouped, error) => {
    grouped[error.field] = [...(grouped[error.field] ?? []), error.reason];
    return grouped;
  }, {});
}

function cloneCommand(command: QuestCommand): QuestCommand {
  switch (command.kind) {
    case 'CREATE_QUEST':
      return { ...command, input: { ...command.input, firstAction: { ...command.input.firstAction } } };
    case 'CREATE_ACTION':
      return { ...command, input: { ...command.input } };
    case 'RECORD_ATTEMPT':
      return { ...command, input: { ...command.input } };
    case 'ADAPT_ACTION':
      return { ...command, input: { ...command.input } };
    case 'COMPLETE_QUEST':
      return { ...command, input: { ...command.input } };
    case 'ARCHIVE_QUEST':
      return { ...command, input: { ...command.input } };
    case 'DELETE_WORKSPACE':
      return { ...command };
  }
}
