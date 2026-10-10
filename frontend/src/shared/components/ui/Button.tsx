import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const VARIANTS = {
  primary: 'bg-accent text-on-accent border-accent hover:opacity-90',
  secondary: 'bg-surface text-fg border-muted hover:bg-neutral-bg',
}

/** Botón de acción. El estado `disabled` no depende solo del color: baja la opacidad y cambia el cursor. */
const Button = ({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) => (
  <button
    type={type}
    className={`min-h-11 cursor-pointer rounded-lg border px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    {...rest}
  />
)

export default Button
