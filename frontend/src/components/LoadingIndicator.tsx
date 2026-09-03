type LoadingIndicatorProps = {
  label?: string
}

export function LoadingIndicator({ label = '불러오는 중' }: LoadingIndicatorProps) {
  return (
    <div className="loading-indicator" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
