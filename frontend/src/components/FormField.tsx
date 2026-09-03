import { useId, type InputHTMLAttributes } from 'react'

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  error?: string
  hint?: string
  id?: string
  label: string
}

export function FormField({ error, hint, id, label, ...inputProps }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [inputProps['aria-describedby'], hintId, errorId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={inputId}>
        {label}
      </label>
      {hint ? (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <input
        {...inputProps}
        id={inputId}
        className="form-field__input"
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : inputProps['aria-invalid']}
      />
      {error ? (
        <p className="form-field__error" id={errorId} role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
