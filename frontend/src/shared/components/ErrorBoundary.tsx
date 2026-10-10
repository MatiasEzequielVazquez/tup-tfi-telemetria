import { Component, type ReactNode } from 'react'
import { Link } from 'react-router'
import Card from './ui/Card'

interface State {
  error: Error | null
}

/** Error inesperado al renderizar una pantalla (no es un error de la API). */
class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Card error role="alert" className="space-y-2">
        <h1 className="text-xl font-bold">Algo salió mal</h1>
        <p>{error.message}</p>
        <p>
          <Link className="text-accent underline" to="/">
            Volver al inicio
          </Link>
        </p>
      </Card>
    )
  }
}

export default ErrorBoundary
