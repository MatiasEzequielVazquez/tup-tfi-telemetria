import { useId, type SelectHTMLAttributes } from 'react'

interface Option {
  value: string
  label: string
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string
  options: Option[]
  onChange: (value: string) => void
  /** Mensaje de error de validación; marca el selector como inválido. */
  error?: string
}

/** Selector con etiqueta visible asociada; el error, si hay, queda asociado al selector. */
const SelectField = ({ label, options, onChange, value, error, ...rest }: SelectFieldProps) => {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <select
        {...rest}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 rounded-lg border bg-surface px-2 text-fg ${error ? 'border-danger-fg' : 'border-muted'}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm font-semibold text-danger-fg">
          {error}
        </p>
      )}
    </div>
  )
}

export default SelectField
