type StatusNoticeProps = {
  description: string
  title: string
  tone?: 'info' | 'success' | 'error'
}

const symbols = {
  info: 'i',
  success: '✓',
  error: '!',
} as const

export function StatusNotice({ description, title, tone = 'info' }: StatusNoticeProps) {
  return (
    <section className={`status-notice status-notice--${tone}`} aria-label={title}>
      <span className="status-notice__symbol" aria-hidden="true">
        {symbols[tone]}
      </span>
      <div>
        <h2 className="status-notice__title">{title}</h2>
        <p className="status-notice__description">{description}</p>
      </div>
    </section>
  )
}
