// LoginPage.tsx — inicio de sesión con correo y contraseña (CU01 · RF01), ruta /login
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import TextField from '../../../shared/components/ui/TextField'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import ConfigErrorCard from '../components/ConfigErrorCard'
import SessionScreen from '../components/SessionScreen'
import { useSession } from '../hooks/useSession'
import { readRedirectPath } from '../utils/redirect'

const LoginPage = () => {
  useDocumentTitle(`Iniciar sesión - ${APP_NAME}`)
  const { snapshot, signIn } = useSession()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (snapshot.status === 'signed-in') {
    return <Navigate to={readRedirectPath(location.state)} replace />
  }

  if (snapshot.status === 'misconfigured') {
    return (
      <SessionScreen>
        <ConfigErrorCard message={snapshot.message} />
      </SessionScreen>
    )
  }

  if (snapshot.status === 'loading') {
    return (
      <SessionScreen>
        <LoaderSpinner label="Verificando sesión…" />
      </SessionScreen>
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SessionScreen>
      <p className="text-center text-lg font-bold">{APP_NAME}</p>
      <Card>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
          <TextField
            label="Correo electrónico"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={setEmail}
          />
          <TextField
            label="Contraseña"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger-fg">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </Button>
        </form>
      </Card>
    </SessionScreen>
  )
}

export default LoginPage
