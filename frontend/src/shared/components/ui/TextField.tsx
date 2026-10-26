import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  onChange: (value: string) => void
}

/** Campo de texto con etiqueta visible asociada. */
const TextField = ({ label, onChange, ...rest }: TextFieldProps) => {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-lg border border-muted bg-surface px-3 text-fg"
        {...rest}
      />
    </div>
  )
}

export default TextField
