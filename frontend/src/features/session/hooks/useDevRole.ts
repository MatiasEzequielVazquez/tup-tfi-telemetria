import { useCallback, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Rol } from '../../../api/types'
import { getDevRole, setDevRole, subscribeDevRole } from '../services/devSessionStore'

/** Rol simulado vigente y cómo cambiarlo. */
export const useDevRole = () => {
  const queryClient = useQueryClient()
  const rol = useSyncExternalStore(subscribeDevRole, getDevRole)

  // Lo que el servidor devuelve puede depender del rol (RN11): se descarta lo cacheado y las
  // consultas activas se vuelven a pedir con el nuevo token.
  const cambiarRol = useCallback(
    (nuevo: Rol) => {
      setDevRole(nuevo)
      void queryClient.resetQueries()
    },
    [queryClient],
  )

  return { rol, cambiarRol }
}
