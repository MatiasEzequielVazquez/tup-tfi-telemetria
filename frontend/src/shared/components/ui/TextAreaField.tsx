import { useId, type TextareaHTMLAttributes } from 'react'

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string
  onChange: (value: string) => void
  /** Ayuda debajo del campo (largo máximo, qué escribir…). */
  hint?: string
  /** Mensaje de error de validación; marca el campo como inválido. */
  error?: string
}

/** Campo de texto de varias líneas con etiqueta visible; la ayuda y el error quedan asociados. */
const TextAreaField = ({ label, onChange, hint, error, rows = 3, ...rest }: TextAreaFieldProps) => {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <textarea
        {...rest}
        id={id}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-lg border bg-surface px-3 py-2 text-fg ${error ? 'border-danger-fg' : 'border-muted'}`}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger-fg">
          {error}
        </p>
      )}
    </div>
  )
}

export default TextAreaField
