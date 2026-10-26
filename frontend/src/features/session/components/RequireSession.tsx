import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useSession } from '../hooks/useSession'
import { LOGIN_PATH, redirectState } from '../utils/redirect'
import ConfigErrorCard from './ConfigErrorCard'
import CurrentUserGate from './CurrentUserGate'
import SessionScreen from './SessionScreen'

/**
 * Ruta de diseño que protege a las demás: sin sesión redirige al login (recordando adónde se
 * quería ir) y, con sesión, deja pasar solo a un usuario habilitado.
 */
const RequireSession = () => {
  const { snapshot } = useSession()
  const location = useLocation()
  const queryClient = useQueryClient()
  const signedOut = snapshot.status === 'signed-out'

  // Al perder la sesión no queda nada de lo que vio el usuario anterior.
  useEffect(() => {
    if (signedOut) queryClient.clear()
  }, [signedOut, queryClient])

  switch (snapshot.status) {
    case 'loading':
      return (
        <SessionScreen>
          <LoaderSpinner label="Verificando sesión…" />
        </SessionScreen>
      )
    case 'misconfigured':
      return (
        <SessionScreen>
          <ConfigErrorCard message={snapshot.message} />
        </SessionScreen>
      )
    case 'signed-out':
      return (
        <Navigate
          to={LOGIN_PATH}
          replace
          state={redirectState(`${location.pathname}${location.search}`)}
        />
      )
    case 'signed-in':
      return <CurrentUserGate />
  }
}

export default RequireSession
