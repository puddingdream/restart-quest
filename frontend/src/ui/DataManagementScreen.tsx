import { InlineError, PageIntro } from './primitives';

interface DataManagementScreenProps {
  isDeleting?: boolean;
  errorMessage?: string;
  onDelete: () => void;
}

export function DataManagementScreen({ isDeleting = false, errorMessage, onDelete }: DataManagementScreenProps) {
  return (
    <section>
      <PageIntro
        eyebrow="데이터 관리"
        title="이 브라우저의 기록을 관리해요"
        description="Re:Start Quest는 계정 없이 이 브라우저에 연결된 익명 공간을 사용해요."
      />
      <section className="info-section" aria-labelledby="session-limit-title">
        <h2 id="session-limit-title">익명 저장의 제한</h2>
        <ul className="plain-list">
          <li><span aria-hidden="true">•</span> 다른 브라우저나 기기와 동기화되지 않아요.</li>
          <li><span aria-hidden="true">•</span> 브라우저 데이터를 지우면 세션을 복구할 수 없어요.</li>
          <li><span aria-hidden="true">•</span> 의료적 진단이나 상담을 제공하지 않아요.</li>
        </ul>
      </section>
      <section className="danger-section" aria-labelledby="delete-title">
        <h2 id="delete-title">전체 데이터 삭제</h2>
        <p>목표, 행동, 막힘과 완료 기록이 모두 영구적으로 삭제되며 되돌릴 수 없어요.</p>
        {errorMessage ? <InlineError>{errorMessage}</InlineError> : null}
        <button className="button button--danger" onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? '삭제하는 중…' : '내 데이터 모두 삭제하기'}
        </button>
      </section>
    </section>
  );
}
