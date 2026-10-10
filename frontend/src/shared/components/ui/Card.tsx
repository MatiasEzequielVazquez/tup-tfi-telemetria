import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'li' | 'section'
  /** Borde de error (paneles de error de carga). */
  error?: boolean
}

/** Contenedor con borde y fondo de superficie, usado en tarjetas, paneles y estados vacíos. */
const Card = ({ as: Tag = 'div', error = false, className = '', ...rest }: CardProps) => (
  <Tag
    className={`rounded-lg border bg-surface p-4 ${error ? 'border-danger-fg' : 'border-line'} ${className}`}
    {...rest}
  />
)

export default Card
