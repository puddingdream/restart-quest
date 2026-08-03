interface SessionUnavailableScreenProps {
  onRetry: () => void
}

export function SessionUnavailableScreen({
  onRetry,
}: SessionUnavailableScreenProps) {
  return (
    <main className="page-container" role="alert">
      <section className="surface-card">
        <h1>서버에 잠시 연결할 수 없어요</h1>
        <p>
          로그인 정보는 그대로 보관했습니다. 연결을 확인한 뒤 다시 시도해 주세요.
        </p>
        <button className="button button-primary" onClick={onRetry}>
          다시 연결하기
        </button>
      </section>
    </main>
  )
}
