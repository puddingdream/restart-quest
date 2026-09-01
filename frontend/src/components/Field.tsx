import { useId, type InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
}

export function Field({
  error,
  hint,
  id: providedId,
  label,
  ...inputProps
}: FieldProps) {
  const generatedId = useId()
  const inputId = providedId ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>{label}</label>
      {hint && <p className="field__hint" id={hintId}>{hint}</p>}
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="field__control"
        id={inputId}
      />
      {error && <p className="field__error" id={errorId}>확인 필요: {error}</p>}
    </div>
  )
}
