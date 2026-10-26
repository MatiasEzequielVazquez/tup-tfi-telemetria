import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  onChange: (value: string) => void
  /** Ayuda debajo del campo (formato, valor actual…). */
  hint?: string
  /** Mensaje de error de validación; marca el campo como inválido. */
  error?: string
}

/** Campo de texto con etiqueta visible; la ayuda y el error quedan asociados al campo. */
const TextField = ({ label, onChange, hint, error, ...rest }: TextFieldProps) => {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 rounded-lg border bg-surface px-3 text-fg ${error ? 'border-danger-fg' : 'border-muted'}`}
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

export default TextField
