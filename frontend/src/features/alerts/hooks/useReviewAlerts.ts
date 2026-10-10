import { useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { reviewAlert } from '../services/alertsService'
import type { Alerta } from '../types'
import { ALERTS_LIST_QUERY_KEY } from '../utils/filters'
import { alertKey } from '../utils/identity'
import { ALERT_TYPE_INFO } from '../utils/labels'

/**
 * Opciones de la mutación de revisión. Al confirmar el servidor se vuelven a pedir las
 * listas de alertas, y la mutación sigue "en curso" hasta que esas listas se actualizaron:
 * así la acción no vuelve a habilitarse con datos viejos en pantalla.
 */
export const reviewAlertMutationOptions = (queryClient: QueryClient) => ({
  mutationFn: (alerta: Alerta) => reviewAlert(alerta),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ALERTS_LIST_QUERY_KEY }),
})

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'No se pudo marcar la alerta como revisada.'

/**
 * Revisión de alertas con seguimiento por alerta (identificada por origen + clave): en curso,
 * error y el último resultado confirmado, para comunicarlo en una región accesible.
 */
export const useReviewAlerts = () => {
  const queryClient = useQueryClient()
  const mutation = useMutation(reviewAlertMutationOptions(queryClient))

  // El ref evita envíos duplicados en el mismo instante (el estado se actualiza después).
  const inFlight = useRef(new Set<string>())
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set())
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const review = useCallback(
    async (alerta: Alerta) => {
      const key = alertKey(alerta)
      if (inFlight.current.has(key)) return

      inFlight.current.add(key)
      setPendingKeys(new Set(inFlight.current))
      setAnnouncement(null)
      setErrors(({ [key]: _previous, ...rest }) => rest)

      try {
        await mutation.mutateAsync(alerta)
        const unidad = alerta.patente ? ` de ${alerta.patente}` : ''
        setAnnouncement(`Alerta marcada como revisada: ${ALERT_TYPE_INFO[alerta.tipo].label}${unidad}.`)
      } catch (error) {
        setErrors((current) => ({ ...current, [key]: errorMessage(error) }))
      } finally {
        inFlight.current.delete(key)
        setPendingKeys(new Set(inFlight.current))
      }
    },
    [mutation],
  )

  return {
    review,
    isReviewing: (alerta: Alerta) => pendingKeys.has(alertKey(alerta)),
    errorFor: (alerta: Alerta): string | null => errors[alertKey(alerta)] ?? null,
    /** Resultado confirmado de la última revisión (para una región `aria-live`). */
    announcement,
    clearAnnouncement: () => setAnnouncement(null),
  }
}
