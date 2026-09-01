import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary'
    isLoading?: boolean
    loadingLabel?: string
  }
>

export function Button({
  children,
  className = '',
  disabled,
  isLoading = false,
  loadingLabel = '처리 중…',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, className].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      className={classes}
      disabled={disabled || isLoading}
      type={type}
    >
      <span>{isLoading ? loadingLabel : children}</span>
    </button>
  )
}
