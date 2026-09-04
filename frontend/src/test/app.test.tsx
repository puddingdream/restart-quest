import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiClient, type BootstrapResponse, type HistoryEntry } from '../api';
import { RestartQuestApp } from '../app/RestartQuestApp';
import { QuestFlowController } from '../state';
import { createMockHttp, jsonResponse, type HttpStep } from './httpFixture';

const UUID = '123e4567-e89b-42d3-a456-426614174000';
const CREATED_AT = '2026-09-05T00:00:00Z';

const quest = {
  id: 'quest-1',
  status: 'ACTIVE' as const,
  title: '프론트엔드 직무 찾기',
  version: 0,
  createdAt: CREATED_AT,
};

const firstAction = {
  id: 'action-1',
  questId: quest.id,
  status: 'READY' as const,
  title: '채용 페이지 열기',
  estimatedMinutes: 10,
  createdAt: CREATED_AT,
};

const attempt = {
  id: 'attempt-1',
  actionId: firstAction.id,
  outcome: 'BLOCKED' as const,
  blockerCode: 'TOO_BIG' as const,
  createdAt: CREATED_AT,
};

const suggestion = {
  strategyCode: 'FIRST_STEP_ONLY',
  guidance: '첫 단계만 분리했어요.',
  title: '첫 단계만 하기: 채용 페이지 열기',
  estimatedMinutes: 5,
};

const successor = {
  id: 'action-2',
  questId: quest.id,
  status: 'READY' as const,
  title: '관심 회사 채용 페이지 하나 열기',
  estimatedMinutes: 5,
  sourceAttemptId: attempt.id,
  createdAt: CREATED_AT,
};

const blockedHistory: HistoryEntry = {
  attempt,
  action: { ...firstAction, status: 'BLOCKED', endedAt: CREATED_AT },
  successorAction: successor,
};

const doneHistory: HistoryEntry = {
  attempt: {
    id: 'attempt-2',
    actionId: successor.id,
    outcome: 'DONE',
    createdAt: CREATED_AT,
  },
  action: { ...successor, status: 'DONE', endedAt: CREATED_AT },
};

function bootstrap(overrides: Partial<BootstrapResponse> = {}): BootstrapResponse {
  return {
    workspace: { id: 'workspace-1', timezone: 'Asia/Seoul' },
    activeQuest: null,
    currentAction: null,
    pendingAdaptation: null,
    recentAttempts: [],
    nextRequiredAction: 'CREATE_QUEST',
    csrfToken: 'csrf-test',
    ...overrides,
  };
}

function setup(steps: HttpStep[], hash = '#now') {
  window.location.hash = hash;
  const http = createMockHttp(steps);
  const api = new ApiClient({ fetch: http.fetch, uuid: () => UUID });
  const controller = new QuestFlowController(api, 'Asia/Seoul');
  render(<RestartQuestApp api={api} controller={controller} confirmAction={() => true} />);
  return { http, controller };
}

beforeEach(() => {
  window.location.hash = '#now';
  sessionStorage.clear();
});

describe('실제 route와 server state 조립', () => {
  it('목표 생성부터 BLOCKED, 수정 수락, successor DONE, 이력까지 연결한다', async () => {
    const user = userEvent.setup();
    const { http } = setup([
      jsonResponse(bootstrap()),
      jsonResponse({ quest, action: firstAction, nextRequiredAction: 'DO_READY_ACTION' }, 201),
      jsonResponse(bootstrap({ activeQuest: quest, currentAction: firstAction, nextRequiredAction: 'DO_READY_ACTION' })),
      jsonResponse({ attempt, suggestion, nextRequiredAction: 'ADAPT_BLOCKED_ACTION' }, 201),
      jsonResponse(bootstrap({
        activeQuest: quest,
        pendingAdaptation: { attempt, suggestion },
        recentAttempts: [{ attempt, action: { ...firstAction, status: 'BLOCKED' } }],
        nextRequiredAction: 'ADAPT_BLOCKED_ACTION',
      })),
      jsonResponse({ action: successor, nextRequiredAction: 'DO_READY_ACTION' }, 201),
      jsonResponse(bootstrap({
        activeQuest: quest,
        currentAction: successor,
        recentAttempts: [blockedHistory],
        nextRequiredAction: 'DO_READY_ACTION',
      })),
      jsonResponse({ attempt: doneHistory.attempt, nextRequiredAction: 'CREATE_NEXT_ACTION_OR_COMPLETE' }, 201),
      jsonResponse(bootstrap({
        activeQuest: quest,
        recentAttempts: [doneHistory, blockedHistory],
        nextRequiredAction: 'CREATE_NEXT_ACTION_OR_COMPLETE',
      })),
      jsonResponse({ items: [doneHistory, blockedHistory], nextCursor: null }),
    ]);

    await screen.findByRole('heading', { name: '오늘의 작은 행동부터 시작해요' });
    await user.type(screen.getByLabelText('이루고 싶은 구직 목표'), quest.title);
    await user.type(screen.getByLabelText('오늘 할 가장 작은 행동'), firstAction.title);
    await user.click(screen.getByRole('button', { name: '작은 행동 시작하기' }));

    await screen.findByRole('heading', { name: firstAction.title });
    await user.click(screen.getByRole('button', { name: '막혔어요' }));
    await screen.findByRole('heading', { name: '어떤 점에서 막혔나요?' });
    await user.click(screen.getByRole('radio', { name: /생각보다 너무 커요/ }));
    await user.click(screen.getByRole('button', { name: '막힘 기록하기' }));

    await screen.findByRole('heading', { name: '다음 행동을 이만큼 줄여 봤어요' });
    const adaptedTitle = screen.getByLabelText('더 작은 다음 행동');
    await user.clear(adaptedTitle);
    await user.type(adaptedTitle, successor.title);
    await user.click(screen.getByRole('button', { name: '이 행동으로 다시 시작하기' }));

    await screen.findByRole('heading', { name: successor.title });
    await user.click(screen.getByRole('button', { name: '완료했어요' }));
    await screen.findByRole('heading', { name: '한 걸음 진행했어요' });
    expect(screen.getByText(new RegExp(successor.title))).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '기록' }));
    await screen.findByRole('heading', { name: '다시 시작한 과정을 확인해요' });
    expect(screen.getAllByText(successor.title).length).toBeGreaterThan(0);
    expect(screen.getByText('막힌 이유: 생각보다 너무 커요')).toBeInTheDocument();
    expect(http.calls.map((call) => new URL(String(call.input), 'http://test').pathname)).toEqual([
      '/api/v1/bootstrap',
      '/api/v1/quests',
      '/api/v1/bootstrap',
      '/api/v1/actions/action-1/attempts',
      '/api/v1/bootstrap',
      '/api/v1/attempts/attempt-1/adaptation',
      '/api/v1/bootstrap',
      '/api/v1/actions/action-2/attempts',
      '/api/v1/bootstrap',
      '/api/v1/history',
    ]);
  });

  it('pending adaptation route에 다시 진입하고 브라우저 뒤로 가기로 지금 화면을 복구한다', async () => {
    const user = userEvent.setup();
    setup([
      jsonResponse(bootstrap({
        activeQuest: quest,
        pendingAdaptation: { attempt, suggestion },
        recentAttempts: [blockedHistory],
        nextRequiredAction: 'ADAPT_BLOCKED_ACTION',
      })),
    ]);

    await screen.findByRole('heading', { name: '막힌 행동을 더 작게 바꿀 수 있어요' });
    await user.click(screen.getByRole('button', { name: '다시 설계 이어가기' }));
    await screen.findByRole('heading', { name: '다음 행동을 이만큼 줄여 봤어요' });
    window.history.back();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '막힌 행동을 더 작게 바꿀 수 있어요' })).toBeInTheDocument();
    });
  });

  it('전체 삭제 뒤 이전 snapshot을 버리고 새 session/bootstrap으로 시작한다', async () => {
    const user = userEvent.setup();
    const sessionRequired = {
      type: 'about:blank',
      title: '세션이 필요합니다.',
      status: 401,
      code: 'SESSION_REQUIRED',
      detail: '새 세션을 시작해 주세요.',
      fieldErrors: [],
    };
    const { http } = setup([
      jsonResponse(bootstrap({ activeQuest: quest, currentAction: firstAction, nextRequiredAction: 'DO_READY_ACTION' })),
      new Response(null, { status: 204 }),
      jsonResponse(sessionRequired, 401),
      jsonResponse({ csrfToken: 'csrf-new' }, 201),
      jsonResponse(bootstrap({ workspace: { id: 'workspace-2', timezone: 'Asia/Seoul' }, csrfToken: 'csrf-new' })),
    ]);

    await screen.findByRole('heading', { name: firstAction.title });
    await user.click(screen.getByRole('link', { name: '데이터 관리' }));
    await user.click(screen.getByRole('button', { name: '내 데이터 모두 삭제하기' }));
    await screen.findByRole('heading', { name: '오늘의 작은 행동부터 시작해요' });

    const deleteCall = http.calls.find((call) => call.init?.method === 'DELETE');
    const headers = new Headers(deleteCall?.init?.headers);
    expect(headers.get('X-Confirm-Delete')).toBe('delete-my-data');
    expect(http.calls.map((call) => call.init?.method ?? 'GET')).toEqual(['GET', 'DELETE', 'GET', 'POST', 'GET']);
  });

  it('완료 후 다음 행동을 만들고 진행 중 목표를 보관한다', async () => {
    const user = userEvent.setup();
    const nextAction = {
      id: 'action-3',
      questId: quest.id,
      status: 'READY' as const,
      title: '지원할 회사 한 곳 정리하기',
      estimatedMinutes: 10,
      createdAt: CREATED_AT,
    };
    setup([
      jsonResponse(bootstrap({
        activeQuest: quest,
        recentAttempts: [doneHistory, blockedHistory],
        nextRequiredAction: 'CREATE_NEXT_ACTION_OR_COMPLETE',
      })),
      jsonResponse({ action: nextAction, nextRequiredAction: 'DO_READY_ACTION' }, 201),
      jsonResponse(bootstrap({ activeQuest: quest, currentAction: nextAction, nextRequiredAction: 'DO_READY_ACTION' })),
      jsonResponse({
        quest: { ...quest, status: 'ARCHIVED', version: 1, archivedAt: CREATED_AT },
        nextRequiredAction: 'START_NEW_QUEST',
      }),
      jsonResponse(bootstrap({ nextRequiredAction: 'START_NEW_QUEST' })),
    ]);

    await screen.findByRole('heading', { name: '한 걸음 진행했어요' });
    await user.click(screen.getByRole('button', { name: /다음 행동 만들기/ }));
    await screen.findByRole('heading', { name: '이어갈 작은 행동을 정해요' });
    await user.type(screen.getByLabelText('다음 행동'), nextAction.title);
    await user.click(screen.getByRole('button', { name: '다음 행동 시작하기' }));

    await screen.findByRole('heading', { name: nextAction.title });
    await user.click(screen.getByText('목표 관리'));
    await user.click(screen.getByRole('button', { name: '이 목표 보관하기' }));
    await screen.findByRole('heading', { name: '오늘의 작은 행동부터 시작해요' });
  });
});
