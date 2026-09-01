import type { PropsWithChildren } from 'react'

type FeedbackProps = PropsWithChildren<{
  tone?: 'info' | 'success' | 'error'
  title: string
}>

const toneLabels = {
  info: '안내',
  success: '완료',
  error: '확인 필요',
} as const

export function Feedback({ children, title, tone = 'info' }: FeedbackProps) {
  return (
    <div
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`feedback feedback--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="feedback__label">{toneLabels[tone]}</span>
      <strong>{title}</strong>
      <div className="feedback__content">{children}</div>
    </div>
  )
}
