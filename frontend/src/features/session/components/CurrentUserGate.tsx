import { Outlet } from 'react-router'
import { ApiError } from '../../../api/client'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useSession } from '../hooks/useSession'
import SessionScreen from './SessionScreen'

/**
 * Deja pasar solo cuando el servidor reconoce al usuario (GET /me). Un usuario válido en
 * Supabase pero sin fila en `usuarios` recibe 403 `usuario_no_habilitado` (RN11).
 */
const CurrentUserGate = () => {
  const { data, error } = useCurrentUser()
  const { mode, signOut } = useSession()
  const retry = useRetryFailedQueries()

  // Con el usuario ya cargado, un error al actualizarlo no interrumpe el trabajo.
  if (data) return <Outlet />

  const logout = mode === 'supabase' && (
    <Button variant="secondary" onClick={() => void signOut().catch(() => {})}>
      Cerrar sesión
    </Button>
  )

  if (error instanceof ApiError && error.code === 'usuario_no_habilitado') {
    return (
      <SessionScreen>
        <Card error role="alert" className="space-y-3">
          <h1 className="text-xl font-bold">Acceso no habilitado</h1>
          <p>{error.message}</p>
          {logout}
        </Card>
      </SessionScreen>
    )
  }

  if (error) {
    return (
      <SessionScreen>
        <ErrorPanel title="No se pudo verificar tu usuario" error={error} onRetry={retry} />
        {logout}
      </SessionScreen>
    )
  }

  return (
    <SessionScreen>
      <LoaderSpinner label="Verificando usuario…" />
    </SessionScreen>
  )
}

export default CurrentUserGate
