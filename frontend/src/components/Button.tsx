import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  isLoading?: boolean
  loadingLabel?: string
  variant?: 'primary' | 'secondary'
}

export function Button({
  children,
  className = '',
  disabled,
  isLoading = false,
  loadingLabel = '처리 중',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, className].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? <span className="spinner" aria-hidden="true" /> : null}
      <span>{isLoading ? loadingLabel : children}</span>
    </button>
  )
}
