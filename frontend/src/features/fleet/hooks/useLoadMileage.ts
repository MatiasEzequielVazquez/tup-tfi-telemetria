import { useMutation, useQueryClient } from '@tanstack/react-query'
import { loadMileage } from '../services/fleetService'
import type { MileageInput } from '../types'

/**
 * Carga manual de kilometraje de una unidad. Al confirmar el servidor se vuelven a pedir los
 * datos en pantalla y la mutación sigue "en curso" hasta entonces, así el formulario no se
 * cierra con datos viejos detrás.
 *
 * Se invalida todo y no solo la flota: el nuevo kilometraje recalcula los planes y puede
 * generar alertas, que son de otra feature (alerts) y de la que esta no puede depender.
 */
export const useLoadMileage = (patente: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MileageInput) => loadMileage(patente, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
