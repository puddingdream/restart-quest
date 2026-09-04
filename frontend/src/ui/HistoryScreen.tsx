import { PageIntro, StatePanel, StatusLabel } from './primitives';
import type { AsyncViewState, HistoryItem } from './types';

interface HistoryScreenProps {
  state: AsyncViewState;
  items?: HistoryItem[];
  errorMessage?: string;
  onRetry?: () => void;
}

export function HistoryScreen({ state, items = [], errorMessage, onRetry }: HistoryScreenProps) {
  if (state === 'loading') {
    return <StatePanel kind="loading" title="기록을 불러오는 중이에요" description="최근 행동부터 정리하고 있어요." />;
  }

  if (state === 'error') {
    return (
      <StatePanel
        kind="error"
        title="기록을 불러오지 못했어요"
        description={errorMessage ?? '연결을 확인한 뒤 다시 시도해 주세요.'}
        action={<button className="button button--primary" onClick={onRetry}>다시 시도하기</button>}
      />
    );
  }

  if (state === 'empty') {
    return <StatePanel kind="empty" title="아직 기록이 없어요" description="첫 행동을 완료하거나 막힘을 기록하면 여기에 과정이 남아요." />;
  }

  return (
    <section>
      <PageIntro eyebrow="기록" title="다시 시작한 과정을 확인해요" description="가장 최근 행동부터 보여 드려요." />
      <ol className="history-list">
        {items.map((item) => (
          <li className="history-item" key={item.id}>
            <div className="history-heading">
              <StatusLabel kind={item.outcome} />
              <time>{item.createdAtLabel}</time>
            </div>
            <h2>{item.actionTitle}</h2>
            {item.blockerLabel ? <p>막힌 이유: {item.blockerLabel}</p> : null}
            {item.successorTitle ? (
              <div className="successor-link">
                <span aria-hidden="true">↳</span>
                <span><strong>다시 시작한 행동</strong>{item.successorTitle}</span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
