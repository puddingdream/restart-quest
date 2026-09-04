import { describe, expect, it } from 'vitest';
import {
  ApiClient,
  NEXT_REQUIRED_ACTIONS,
  type BootstrapResponse,
  type NextRequiredAction,
} from '../api';
import { QuestFlowController, type QuestCommand } from '../state';
import { createMockHttp, jsonResponse, type HttpStep } from './httpFixture';

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const CREATED_AT = '2026-09-05T00:00:00Z';

const createQuest = {
  kind: 'CREATE_QUEST',
  input: {
    title: '프론트엔드 직무 찾기',
    firstAction: { title: '채용 페이지 열기', estimatedMinutes: 5 },
  },
} satisfies QuestCommand;

function bootstrap(
  nextRequiredAction: NextRequiredAction,
  overrides: Partial<BootstrapResponse> = {},
): BootstrapResponse {
  return {
    workspace: { id: 'workspace-1', timezone: 'Asia/Seoul' },
    activeQuest: null,
    currentAction: null,
    pendingAdaptation: null,
    recentAttempts: [],
    nextRequiredAction,
    csrfToken: 'csrf-for-tests',
    ...overrides,
  };
}

function createdQuestResponse(nextRequiredAction: NextRequiredAction = 'DO_READY_ACTION') {
  return {
    quest: {
      id: 'quest-1',
      status: 'ACTIVE',
      title: createQuest.input.title,
      version: 0,
      createdAt: CREATED_AT,
    },
    action: {
      id: 'action-1',
      questId: 'quest-1',
      status: 'READY',
      title: createQuest.input.firstAction.title,
      estimatedMinutes: createQuest.input.firstAction.estimatedMinutes,
      createdAt: CREATED_AT,
    },
    nextRequiredAction,
  };
}

function problem(status: number, code: string, fieldErrors: Array<{ field: string; reason: string }> = []) {
  return {
    type: `https://restart-quest.example/problems/${code.toLowerCase()}`,
    title: '요청을 처리할 수 없습니다.',
    status,
    code,
    detail: '입력을 보존하고 다시 시도해 주세요.',
    fieldErrors,
    traceId: 'trace-1',
  };
}

function setup(steps: HttpStep[]) {
  const http = createMockHttp(steps);
  const api = new ApiClient({ fetch: http.fetch, uuid: () => UUID });
  const flow = new QuestFlowController(api, 'Asia/Seoul');
  return { flow, http };
}

describe('session bootstrap과 typed server state', () => {
  it('새 방문의 401에서 session을 만든 뒤 bootstrap을 복구한다', async () => {
    const { flow, http } = setup([
      jsonResponse(problem(401, 'SESSION_REQUIRED'), 401),
      jsonResponse({ csrfToken: 'new-csrf' }, 201),
      jsonResponse(bootstrap('CREATE_QUEST', { csrfToken: 'new-csrf' })),
    ]);

    await flow.initialize();

    expect(http.calls.map((call) => [String(call.input), call.init?.method ?? 'GET'])).toEqual([
      ['/api/v1/bootstrap', 'GET'],
      ['/api/v1/session', 'POST'],
      ['/api/v1/bootstrap', 'GET'],
    ]);
    expect(flow.getSnapshot()).toMatchObject({
      phase: 'ready',
      nextRequiredAction: 'CREATE_QUEST',
    });
  });

  it('재방문은 기존 cookie로 bootstrap만 조회한다', async () => {
    const { flow, http } = setup([jsonResponse(bootstrap('DO_READY_ACTION'))]);

    await flow.initialize();

    expect(http.calls).toHaveLength(1);
    expect(http.calls[0]?.init?.credentials).toBe('same-origin');
    expect(flow.getSnapshot().nextRequiredAction).toBe('DO_READY_ACTION');
  });

  it.each(NEXT_REQUIRED_ACTIONS)('%s 값을 클라이언트 추론 없이 전달한다', async (nextRequiredAction) => {
    const http = createMockHttp([jsonResponse(bootstrap(nextRequiredAction))]);
    const api = new ApiClient({ fetch: http.fetch });

    const result = await api.getBootstrap();

    expect(result.nextRequiredAction).toBe(nextRequiredAction);
  });
});

describe('write 안전성과 입력 보존', () => {
  it('모든 인증 write의 공통 헤더를 적용하고 진행 중인 중복 submit을 한 요청으로 합친다', async () => {
    let resolveWrite: ((response: Response) => void) | undefined;
    const pendingWrite = new Promise<Response>((resolve) => {
      resolveWrite = resolve;
    });
    const { flow, http } = setup([
      jsonResponse(bootstrap('CREATE_QUEST')),
      () => pendingWrite,
    ]);
    await flow.initialize();

    const first = flow.submit(createQuest);
    const duplicate = flow.submit(createQuest);

    expect(duplicate).toBe(first);
    expect(http.calls).toHaveLength(2);
    const headers = new Headers(http.calls[1]?.init?.headers);
    expect(headers.get('X-CSRF-Token')).toBe('csrf-for-tests');
    expect(headers.get('Idempotency-Key')).toBe(UUID);
    expect(UUID).toMatch(/^[0-9a-f-]{36}$/);

    resolveWrite?.(jsonResponse(createdQuestResponse(), 201));
    await first;
    expect(flow.getSnapshot()).toMatchObject({
      phase: 'ready',
      nextRequiredAction: 'DO_READY_ACTION',
      retainedSubmission: null,
    });
  });

  it('field validation 오류를 매핑하고 제출 입력을 보존한다', async () => {
    const { flow } = setup([
      jsonResponse(bootstrap('CREATE_QUEST')),
      jsonResponse(problem(400, 'VALIDATION_FAILED', [
        { field: 'title', reason: 'INVALID_LENGTH' },
        { field: 'firstAction.title', reason: 'REQUIRED' },
      ]), 400),
    ]);
    await flow.initialize();

    await flow.submit(createQuest);

    expect(flow.getSnapshot()).toMatchObject({
      phase: 'ready',
      recoveryReason: 'VALIDATION',
      fieldErrors: {
        title: ['INVALID_LENGTH'],
        'firstAction.title': ['REQUIRED'],
      },
      retainedSubmission: { command: createQuest, retryable: false },
    });
  });

  it('write 401에서 session과 bootstrap을 재생성하되 입력을 자동 재전송하지 않는다', async () => {
    const { flow, http } = setup([
      jsonResponse(bootstrap('CREATE_QUEST')),
      jsonResponse(problem(401, 'SESSION_REQUIRED'), 401),
      jsonResponse({ csrfToken: 'recreated-csrf' }, 201),
      jsonResponse(bootstrap('CREATE_QUEST', { csrfToken: 'recreated-csrf' })),
    ]);
    await flow.initialize();

    await flow.submit(createQuest);

    expect(http.calls).toHaveLength(4);
    expect(flow.getSnapshot()).toMatchObject({
      phase: 'ready',
      recoveryReason: 'SESSION_RECREATED',
      nextRequiredAction: 'CREATE_QUEST',
      retainedSubmission: { command: createQuest, retryable: false },
    });
  });

  it('409 stale state에서 bootstrap을 다시 읽어 pending adaptation을 복구하고 입력을 보존한다', async () => {
    const pendingAdaptation = {
      attempt: {
        id: 'attempt-1',
        actionId: 'action-1',
        outcome: 'BLOCKED' as const,
        blockerCode: 'TOO_BIG' as const,
        createdAt: CREATED_AT,
      },
      suggestion: {
        strategyCode: 'FIRST_STEP_ONLY',
        guidance: '첫 단계만 분리했어요.',
        title: '채용 페이지 하나 열기',
        estimatedMinutes: 5,
      },
    };
    const { flow, http } = setup([
      jsonResponse(bootstrap('CREATE_QUEST')),
      jsonResponse(problem(409, 'STALE_STATE'), 409),
      jsonResponse(bootstrap('ADAPT_BLOCKED_ACTION', { pendingAdaptation })),
    ]);
    await flow.initialize();

    await flow.submit(createQuest);

    expect(http.calls.map((call) => String(call.input))).toEqual([
      '/api/v1/bootstrap',
      '/api/v1/quests',
      '/api/v1/bootstrap',
    ]);
    expect(flow.getSnapshot()).toMatchObject({
      phase: 'ready',
      recoveryReason: 'STALE_STATE',
      nextRequiredAction: 'ADAPT_BLOCKED_ACTION',
      bootstrap: { pendingAdaptation },
      retainedSubmission: { command: createQuest, retryable: false },
    });
  });

  it.each([
    ['offline', new TypeError('offline'), 'OFFLINE'],
    ['5xx', jsonResponse(problem(503, 'SERVICE_UNAVAILABLE'), 503), 'SERVER_ERROR'],
  ] as const)('%s 실패 후 같은 idempotency key로 재시도하고 중복 응답을 수용한다', async (_case, failure, reason) => {
    const { flow, http } = setup([
      jsonResponse(bootstrap('CREATE_QUEST')),
      failure,
      jsonResponse(createdQuestResponse(), 201, { 'Idempotency-Replayed': 'true' }),
    ]);
    await flow.initialize();

    await flow.submit(createQuest);
    expect(flow.getSnapshot()).toMatchObject({
      phase: 'error',
      recoveryReason: reason,
      retainedSubmission: { command: createQuest, idempotencyKey: UUID, retryable: true },
    });

    await flow.retry();

    const firstHeaders = new Headers(http.calls[1]?.init?.headers);
    const retryHeaders = new Headers(http.calls[2]?.init?.headers);
    expect(retryHeaders.get('Idempotency-Key')).toBe(firstHeaders.get('Idempotency-Key'));
    expect(flow.getSnapshot()).toMatchObject({
      phase: 'ready',
      nextRequiredAction: 'DO_READY_ACTION',
      retainedSubmission: null,
      lastMutationReplayed: true,
    });
  });
});
