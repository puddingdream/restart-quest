import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { ApiClient, type BlockerCode, type HistoryEntry, type HistoryResponse } from '../api';
import { QuestFlowController, type QuestCommand, type QuestFlowState } from '../state';
import {
  AdaptationFormScreen,
  AppShell,
  BlockerFormScreen,
  DataManagementScreen,
  ErrorScreen,
  HistoryScreen,
  InlineError,
  LoadingScreen,
  NextChoiceScreen,
  PageIntro,
  PendingAdaptationScreen,
  QuestCompletedScreen,
  ReadyScreen,
  StartScreen,
  type HistoryItem,
  type StartQuestValues,
} from '../ui';

type Route = 'now' | 'blocked' | 'adapt' | 'next-action' | 'completed' | 'history' | 'data';

const BLOCKER_LABELS: Record<BlockerCode, string> = {
  TOO_BIG: '생각보다 너무 커요',
  LOW_ENERGY: '지금은 에너지가 부족해요',
  UNCLEAR: '어디까지 해야 할지 모르겠어요',
  NO_TIME: '시간이 부족해요',
  OTHER: '다른 이유가 있어요',
};

const COMPLETED_QUEST_KEY = 'restart-quest.completed-title';
const defaultApi = new ApiClient();
const defaultController = new QuestFlowController(defaultApi, resolvedTimezone());

interface RestartQuestAppProps {
  api?: ApiClient;
  controller?: QuestFlowController;
  confirmAction?: (message: string) => boolean;
}

export function RestartQuestApp({
  api = defaultApi,
  controller = defaultController,
  confirmAction = (message) => window.confirm(message),
}: RestartQuestAppProps) {
  const flow = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const route = useHashRoute();
  const [mutationTransition, setMutationTransition] = useState(false);
  const [historyState, setHistoryState] = useState<
    | { kind: 'idle' | 'loading'; items: HistoryItem[]; message?: undefined }
    | { kind: 'ready'; items: HistoryItem[]; message?: undefined }
    | { kind: 'error'; items: HistoryItem[]; message: string }
  >({ kind: 'idle', items: [] });

  useEffect(() => {
    void controller.initialize();
  }, [controller]);

  const loadHistory = useCallback(async () => {
    setHistoryState({ kind: 'loading', items: [] });
    try {
      const response = await api.getHistory(undefined, 50);
      setHistoryState({ kind: 'ready', items: mapHistory(response, flow.bootstrap?.workspace.timezone) });
    } catch {
      setHistoryState({
        kind: 'error',
        items: [],
        message: '기록을 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.',
      });
    }
  }, [api, flow.bootstrap?.workspace.timezone]);

  useEffect(() => {
    if (route === 'history' && flow.phase === 'ready') void loadHistory();
  }, [flow.phase, loadHistory, route]);

  const submitAndRefresh = useCallback(async (command: QuestCommand): Promise<boolean> => {
    setMutationTransition(true);
    try {
      await controller.submit(command);
      const submitted = controller.getSnapshot();
      if (submitted.retainedSubmission !== null || submitted.recoveryReason !== null) return false;
      await controller.initialize();
      return controller.getSnapshot().phase === 'ready';
    } finally {
      setMutationTransition(false);
    }
  }, [controller]);

  const retry = useCallback(async () => {
    if (controller.getSnapshot().retainedSubmission?.retryable) {
      setMutationTransition(true);
      try {
        await controller.retry();
        const retried = controller.getSnapshot();
        if (retried.retainedSubmission === null && retried.recoveryReason === null) {
          await controller.initialize();
        }
      } finally {
        setMutationTransition(false);
      }
      return;
    }
    await controller.initialize();
  }, [controller]);

  const currentPage = route === 'history' ? '기록' : route === 'data' ? '데이터 관리' : '지금';
  const recoveryMessage = getRecoveryMessage(flow);

  let content: ReactNode;
  if (flow.phase === 'idle' || flow.phase === 'loading'
    || (mutationTransition && flow.phase === 'ready'
      && flow.retainedSubmission === null && flow.recoveryReason === null)) {
    content = <LoadingScreen />;
  } else if (flow.phase === 'error') {
    content = <ErrorScreen message={getErrorMessage(flow)} onRetry={() => void retry()} />;
  } else if (!flow.bootstrap || !flow.nextRequiredAction) {
    content = <ErrorScreen message="현재 상태를 확인하지 못했어요. 다시 불러와 주세요." onRetry={() => void retry()} />;
  } else if (route === 'history') {
    content = (
      <HistoryScreen
        state={historyState.kind === 'idle' || historyState.kind === 'loading'
          ? 'loading'
          : historyState.kind === 'ready' && historyState.items.length === 0 ? 'empty' : historyState.kind}
        items={historyState.items}
        errorMessage={historyState.kind === 'error' ? historyState.message : undefined}
        onRetry={() => void loadHistory()}
      />
    );
  } else if (route === 'data') {
    content = (
      <DataManagementScreen
        isDeleting={flow.phase === 'submitting'}
        errorMessage={recoveryMessage}
        onDelete={() => {
          if (!confirmAction('이 브라우저의 목표와 행동 기록을 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.')) return;
          void submitAndRefresh({ kind: 'DELETE_WORKSPACE' }).then((deleted) => {
            if (deleted) navigate('now');
          });
        }}
      />
    );
  } else {
    content = renderQuestRoute({ route, flow, recoveryMessage, confirmAction, submitAndRefresh });
  }

  return (
    <AppShell currentPage={currentPage}>
      {recoveryMessage && !routeHasRecoveryMessage(route, flow) && flow.phase !== 'error' ? (
        <div className="flow-message"><InlineError>{recoveryMessage}</InlineError></div>
      ) : null}
      {content}
    </AppShell>
  );
}

interface QuestRouteOptions {
  route: Route;
  flow: QuestFlowState;
  recoveryMessage?: string;
  confirmAction: (message: string) => boolean;
  submitAndRefresh: (command: QuestCommand) => Promise<boolean>;
}

function renderQuestRoute({ route, flow, recoveryMessage, confirmAction, submitAndRefresh }: QuestRouteOptions): ReactNode {
  const bootstrap = flow.bootstrap;
  if (!bootstrap) return null;

  const quest = bootstrap.activeQuest;
  const action = bootstrap.currentAction;
  const pending = bootstrap.pendingAdaptation;
  const isSubmitting = flow.phase === 'submitting';

  if (route === 'blocked' && quest && action && flow.nextRequiredAction === 'DO_READY_ACTION') {
    return (
      <BlockerFormScreen
        isSubmitting={isSubmitting}
        errorMessage={recoveryMessage}
        onCancel={() => navigate('now')}
        onSubmit={(values) => {
          void submitAndRefresh({
            kind: 'RECORD_ATTEMPT',
            actionId: action.id,
            input: { outcome: 'BLOCKED', blockerCode: values.blockerCode, ...(values.note ? { note: values.note } : {}) },
          }).then((saved) => {
            if (saved) navigate('adapt');
          });
        }}
      />
    );
  }

  if (route === 'adapt' && pending && flow.nextRequiredAction === 'ADAPT_BLOCKED_ACTION') {
    return (
      <AdaptationFormScreen
        guidance={pending.suggestion.guidance}
        defaultValues={pending.suggestion}
        isSubmitting={isSubmitting}
        errorMessage={recoveryMessage}
        onCancel={() => navigate('now')}
        onSubmit={(values) => {
          void submitAndRefresh({ kind: 'ADAPT_ACTION', attemptId: pending.attempt.id, input: values })
            .then((saved) => {
              if (saved) navigate('now');
            });
        }}
      />
    );
  }

  if (route === 'next-action' && quest && flow.nextRequiredAction === 'CREATE_NEXT_ACTION_OR_COMPLETE') {
    const retained = flow.retainedSubmission?.command;
    const defaults = retained?.kind === 'CREATE_ACTION' ? retained.input : undefined;
    return (
      <NextActionForm
        defaultValues={defaults}
        errorMessage={recoveryMessage}
        isSubmitting={isSubmitting}
        onCancel={() => navigate('now')}
        onSubmit={(input) => {
          void submitAndRefresh({ kind: 'CREATE_ACTION', questId: quest.id, input }).then((saved) => {
            if (saved) navigate('now');
          });
        }}
      />
    );
  }

  if (route === 'completed' && flow.nextRequiredAction === 'START_NEW_QUEST') {
    const title = sessionStorage.getItem(COMPLETED_QUEST_KEY) ?? '완료한 목표';
    return (
      <QuestCompletedScreen
        questTitle={title}
        onCreate={() => {
          sessionStorage.removeItem(COMPLETED_QUEST_KEY);
          navigate('now');
        }}
      />
    );
  }

  switch (flow.nextRequiredAction) {
    case 'CREATE_QUEST':
    case 'START_NEW_QUEST': {
      const retained = flow.retainedSubmission?.command;
      const defaults = retained?.kind === 'CREATE_QUEST' ? startValues(retained.input) : undefined;
      return (
        <StartScreen
          defaultValues={defaults}
          errorMessage={recoveryMessage}
          isSubmitting={isSubmitting}
          onSubmit={(values) => {
            sessionStorage.removeItem(COMPLETED_QUEST_KEY);
            void submitAndRefresh({
              kind: 'CREATE_QUEST',
              input: {
                title: values.questTitle,
                firstAction: { title: values.actionTitle, estimatedMinutes: values.estimatedMinutes },
              },
            }).then((saved) => {
              if (saved) navigate('now');
            });
          }}
        />
      );
    }
    case 'DO_READY_ACTION':
      if (!quest || !action) return inconsistentState();
      return (
        <ReadyScreen
          quest={{ title: quest.title }}
          action={{ title: action.title, estimatedMinutes: action.estimatedMinutes }}
          onBlocked={() => navigate('blocked')}
          onComplete={() => {
            void submitAndRefresh({ kind: 'RECORD_ATTEMPT', actionId: action.id, input: { outcome: 'DONE' } });
          }}
          onArchive={() => {
            if (!confirmAction('이 목표를 보관할까요? 진행 중인 행동은 취소되지만 기록은 유지돼요.')) return;
            void submitAndRefresh({
              kind: 'ARCHIVE_QUEST',
              questId: quest.id,
              input: { version: quest.version },
            }).then((archived) => {
              if (archived) navigate('now');
            });
          }}
        />
      );
    case 'ADAPT_BLOCKED_ACTION':
      if (!pending) return inconsistentState();
      return <PendingAdaptationScreen onResume={() => navigate('adapt')} />;
    case 'CREATE_NEXT_ACTION_OR_COMPLETE': {
      if (!quest) return inconsistentState();
      const completedActionTitle = bootstrap.recentAttempts[0]?.action.title ?? '방금 행동';
      return (
        <NextChoiceScreen
          completedActionTitle={completedActionTitle}
          onCreateNext={() => navigate('next-action')}
          onCompleteQuest={() => {
            sessionStorage.setItem(COMPLETED_QUEST_KEY, quest.title);
            void submitAndRefresh({
              kind: 'COMPLETE_QUEST',
              questId: quest.id,
              input: { version: quest.version },
            }).then((completed) => {
              if (completed) navigate('completed');
              else sessionStorage.removeItem(COMPLETED_QUEST_KEY);
            });
          }}
        />
      );
    }
  }
}

interface NextActionFormProps {
  defaultValues?: { title: string; estimatedMinutes: number };
  errorMessage?: string;
  isSubmitting: boolean;
  onSubmit: (input: { title: string; estimatedMinutes: number }) => void;
  onCancel: () => void;
}

function NextActionForm({ defaultValues, errorMessage, isSubmitting, onSubmit, onCancel }: NextActionFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      title: String(data.get('title') ?? ''),
      estimatedMinutes: Number(data.get('estimatedMinutes')),
    });
  }

  return (
    <section>
      <PageIntro
        eyebrow="다음 행동"
        title="이어갈 작은 행동을 정해요"
        description="같은 목표에서 지금 바로 시작할 수 있는 한 가지를 적어 주세요."
      />
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="next-action-title">다음 행동</label>
          <input id="next-action-title" name="title" defaultValue={defaultValues?.title} maxLength={100} required />
        </div>
        <div className="field field--compact">
          <label htmlFor="next-action-minutes">예상 시간</label>
          <div className="input-suffix">
            <input
              id="next-action-minutes"
              name="estimatedMinutes"
              type="number"
              min={2}
              max={30}
              defaultValue={defaultValues?.estimatedMinutes ?? 10}
              required
            />
            <span aria-hidden="true">분</span>
          </div>
        </div>
        {errorMessage ? <InlineError>{errorMessage}</InlineError> : null}
        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장하는 중…' : '다음 행동 시작하기'}
          </button>
          <button className="button button--quiet" type="button" onClick={onCancel}>돌아가기</button>
        </div>
      </form>
    </section>
  );
}

function inconsistentState(): ReactNode {
  return <ErrorScreen message="서버 상태가 화면 계약과 일치하지 않아요. 최신 상태를 다시 불러와 주세요." onRetry={() => window.location.reload()} />;
}

function startValues(input: { title: string; firstAction: { title: string; estimatedMinutes: number } }): StartQuestValues {
  return {
    questTitle: input.title,
    actionTitle: input.firstAction.title,
    estimatedMinutes: input.firstAction.estimatedMinutes,
  };
}

function getRecoveryMessage(flow: QuestFlowState): string | undefined {
  switch (flow.recoveryReason) {
    case 'VALIDATION':
      return fieldErrorMessage(flow.fieldErrors);
    case 'SESSION_RECREATED':
      return '익명 세션을 다시 만들었어요. 입력은 유지했으니 내용을 확인한 뒤 다시 제출해 주세요.';
    case 'STALE_STATE':
      return '다른 요청으로 상태가 바뀌어 최신 내용을 불러왔어요. 입력은 자동 전송하지 않았습니다.';
    default:
      return undefined;
  }
}

function routeHasRecoveryMessage(route: Route, flow: QuestFlowState): boolean {
  if (route === 'data') return true;
  if (route === 'blocked') return flow.nextRequiredAction === 'DO_READY_ACTION';
  if (route === 'adapt') return flow.nextRequiredAction === 'ADAPT_BLOCKED_ACTION';
  if (route === 'next-action') return flow.nextRequiredAction === 'CREATE_NEXT_ACTION_OR_COMPLETE';
  return route === 'now' && (flow.nextRequiredAction === 'CREATE_QUEST' || flow.nextRequiredAction === 'START_NEW_QUEST');
}

function getErrorMessage(flow: QuestFlowState): string {
  if (flow.recoveryReason === 'OFFLINE') {
    return '서버에 연결할 수 없어요. 입력은 유지했으며 연결 후 같은 요청으로 다시 시도할 수 있어요.';
  }
  return '서버에서 요청을 완료하지 못했어요. 입력은 유지했으며 잠시 뒤 다시 시도할 수 있어요.';
}

function fieldErrorMessage(fieldErrors: Record<string, string[]>): string {
  const fields = Object.keys(fieldErrors);
  if (fields.length === 0) return '입력값을 확인해 주세요.';
  const labels: Record<string, string> = {
    title: '제목',
    'firstAction.title': '첫 행동',
    estimatedMinutes: '예상 시간',
    blockerCode: '막힌 이유',
    note: '메모',
  };
  return `${fields.map((field) => labels[field] ?? '입력값').join(', ')}을(를) 확인해 주세요.`;
}

function mapHistory(response: HistoryResponse, timezone = 'UTC'): HistoryItem[] {
  return response.items.map((entry) => mapHistoryEntry(entry, timezone));
}

function mapHistoryEntry(entry: HistoryEntry, timezone: string): HistoryItem {
  return {
    id: entry.attempt.id,
    outcome: entry.attempt.outcome,
    actionTitle: entry.action.title,
    createdAtLabel: formatDate(entry.attempt.createdAt, timezone),
    ...(entry.attempt.blockerCode ? { blockerLabel: BLOCKER_LABELS[entry.attempt.blockerCode] } : {}),
    ...(entry.successorAction ? { successorTitle: entry.successorAction.title } : {}),
  };
}

function formatDate(value: string, timezone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

function resolvedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return route;
}

function readRoute(): Route {
  const route = window.location.hash.replace(/^#\/?/, '');
  return route === 'blocked' || route === 'adapt' || route === 'next-action' || route === 'completed'
    || route === 'history' || route === 'data'
    ? route
    : 'now';
}

function navigate(route: Route): void {
  window.location.hash = route;
}
