import type { FormEvent } from 'react';
import { InlineError, PageIntro, StatePanel, StatusLabel } from './primitives';
import type { ActionSummary, QuestSummary, StartQuestValues } from './types';

interface StartScreenProps {
  defaultValues?: Partial<StartQuestValues>;
  errorMessage?: string;
  isSubmitting?: boolean;
  onSubmit: (values: StartQuestValues) => void;
}

export function StartScreen({
  defaultValues,
  errorMessage,
  isSubmitting = false,
  onSubmit,
}: StartScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      questTitle: String(data.get('questTitle') ?? ''),
      actionTitle: String(data.get('actionTitle') ?? ''),
      estimatedMinutes: Number(data.get('estimatedMinutes')),
    });
  }

  return (
    <section>
      <PageIntro
        eyebrow="시작"
        title="오늘의 작은 행동부터 시작해요"
        description="막히면 실패로 끝내지 않고, 지금 할 수 있는 더 작은 행동으로 다시 설계해 드려요."
      />
      <aside className="privacy-note" aria-label="익명 저장 안내">
        <span aria-hidden="true">i</span>
        <p>이 브라우저에 익명으로 저장되며 계정 복구와 기기 동기화는 제공하지 않아요.</p>
      </aside>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="quest-title">이루고 싶은 구직 목표</label>
          <p className="field-hint" id="quest-title-hint">예: 이번 주에 지원할 회사 3곳 정하기</p>
          <input
            id="quest-title"
            name="questTitle"
            defaultValue={defaultValues?.questTitle}
            aria-describedby="quest-title-hint"
            maxLength={120}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="action-title">오늘 할 가장 작은 행동</label>
          <p className="field-hint" id="action-title-hint">한 번에 끝낼 수 있는 구체적인 행동으로 적어 주세요.</p>
          <input
            id="action-title"
            name="actionTitle"
            defaultValue={defaultValues?.actionTitle}
            aria-describedby="action-title-hint"
            maxLength={100}
            required
          />
        </div>
        <div className="field field--compact">
          <label htmlFor="estimated-minutes">예상 시간</label>
          <div className="input-suffix">
            <input
              id="estimated-minutes"
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
        <button className="button button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '시작하는 중…' : '작은 행동 시작하기'}
        </button>
      </form>
    </section>
  );
}

export function NoQuestScreen({ onCreate }: { onCreate: () => void }) {
  return (
    <StatePanel
      kind="empty"
      title="진행 중인 목표가 없어요"
      description="지금 가능한 가장 작은 행동 하나를 정하면 다시 시작할 수 있어요."
      action={<button className="button button--primary" onClick={onCreate}>목표 만들기</button>}
    />
  );
}

interface ReadyScreenProps {
  quest: QuestSummary;
  action: ActionSummary;
  onComplete: () => void;
  onBlocked: () => void;
  onArchive: () => void;
}

export function ReadyScreen({ quest, action, onComplete, onBlocked, onArchive }: ReadyScreenProps) {
  return (
    <section>
      <PageIntro
        eyebrow={`진행 중인 목표 · ${quest.title}`}
        title={action.title}
        trailing={<StatusLabel kind="READY" />}
      />
      <div className="action-meta" aria-label={`예상 시간 ${action.estimatedMinutes}분`}>
        <span aria-hidden="true">◷</span>
        <span>약 {action.estimatedMinutes}분</span>
      </div>
      <p className="support-copy">완벽하게 끝내지 않아도 괜찮아요. 지금 할 수 있는 만큼만 해보세요.</p>
      <div className="primary-actions">
        <button className="button button--primary" onClick={onComplete}>완료했어요</button>
        <button className="button button--secondary" onClick={onBlocked}>막혔어요</button>
      </div>
      <details className="secondary-menu">
        <summary>목표 관리</summary>
        <p>진행 중인 행동은 취소되지만 지금까지의 기록은 유지돼요.</p>
        <button className="text-button" onClick={onArchive}>이 목표 보관하기</button>
      </details>
    </section>
  );
}

export function PendingAdaptationScreen({ onResume }: { onResume: () => void }) {
  return (
    <section>
      <PageIntro
        eyebrow="다시 시작할 차례"
        title="막힌 행동을 더 작게 바꿀 수 있어요"
        description="막힌 기록은 저장되어 있어요. 원래 목표를 잃지 않고 이어갈 다음 행동을 확인해 보세요."
        trailing={<StatusLabel kind="BLOCKED" />}
      />
      <button className="button button--primary" onClick={onResume}>다시 설계 이어가기</button>
    </section>
  );
}

interface NextChoiceScreenProps {
  completedActionTitle: string;
  onCreateNext: () => void;
  onCompleteQuest: () => void;
}

export function NextChoiceScreen({ completedActionTitle, onCreateNext, onCompleteQuest }: NextChoiceScreenProps) {
  return (
    <section>
      <PageIntro
        eyebrow="행동 완료"
        title="한 걸음 진행했어요"
        description={`“${completedActionTitle}” 행동을 완료했어요. 이제 다음 행동을 만들거나 목표를 마칠 수 있어요.`}
        trailing={<StatusLabel kind="DONE" />}
      />
      <div className="choice-list" aria-label="다음 선택">
        <button className="choice-button" onClick={onCreateNext}>
          <strong>다음 행동 만들기</strong>
          <span>같은 목표에서 이어갈 작은 행동을 정해요.</span>
        </button>
        <button className="choice-button" onClick={onCompleteQuest}>
          <strong>목표 완료하기</strong>
          <span>이 목표를 완료 상태로 기록해요.</span>
        </button>
      </div>
    </section>
  );
}

export function QuestCompletedScreen({ questTitle, onCreate }: { questTitle: string; onCreate: () => void }) {
  return (
    <section>
      <PageIntro eyebrow="목표 완료" title="여기까지 해낸 과정을 남겼어요" trailing={<StatusLabel kind="DONE" />} />
      <div className="completion-summary">
        <p className="summary-label">완료한 목표</p>
        <p className="summary-value">{questTitle}</p>
        <p>완료와 다시 시작한 기록은 기록 화면에서 언제든 확인할 수 있어요.</p>
      </div>
      <button className="button button--primary" onClick={onCreate}>새 목표 만들기</button>
    </section>
  );
}

export function LoadingScreen() {
  return <StatePanel kind="loading" title="현재 행동을 불러오는 중이에요" description="잠시만 기다려 주세요." />;
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <StatePanel
      kind="error"
      title="화면을 불러오지 못했어요"
      description={message}
      action={<button className="button button--primary" onClick={onRetry}>다시 시도하기</button>}
    />
  );
}
