import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Reintenta, de una sola vez, todas las consultas que están en uso y terminaron en error.
 *
 * Una pantalla suele tener más de una consulta (sus datos y, por ejemplo, la del encabezado).
 * Cuando la API vuelve de una caída, "Reintentar" debe recuperarlas a todas, no solo la de la
 * pantalla. No conoce ningún dominio: mira el estado de las consultas, no sus claves. Las que
 * están bien, o ya no se usan, no se vuelven a pedir.
 */
export const useRetryFailedQueries = () => {
  const queryClient = useQueryClient()

  return useCallback(() => {
    void queryClient.refetchQueries({
      type: 'active',
      predicate: (query) => query.state.status === 'error',
    })
  }, [queryClient])
}
