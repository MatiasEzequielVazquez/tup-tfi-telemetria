import { ApiError } from '../../../api/client'
import Button from './Button'
import Card from './Card'

const errorHint = (error: unknown): string | null => {
  if (error instanceof ApiError && error.code) {
    return `Código: ${error.code}${error.status ? ` · HTTP ${error.status}` : ''}`
  }
  return null
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocurrió un error inesperado.'

interface ErrorPanelProps {
  title: string
  error: unknown
  onRetry?: () => void
}

/** Error de carga con el mensaje de la API y, si se pasa `onRetry`, el botón "Reintentar". */
const ErrorPanel = ({ title, error, onRetry }: ErrorPanelProps) => {
  const hint = errorHint(error)
  return (
    <Card error role="alert" className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p>{errorMessage(error)}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {onRetry && <Button onClick={onRetry}>Reintentar</Button>}
    </Card>
  )
}

export default ErrorPanel
