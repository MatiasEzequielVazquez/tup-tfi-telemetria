import { useMutation, useQueryClient } from '@tanstack/react-query'
import { postponeTask } from '../services/fleetService'
import type { PostponeInput } from '../types'

/**
 * Postergación de una tarea del plan de una unidad. Al confirmar el servidor se vuelven a
 * pedir los datos en pantalla y la mutación sigue "en curso" hasta entonces, así el formulario
 * no se cierra con datos viejos detrás.
 *
 * Se invalida todo y no solo el detalle: la tarea cambia de estado, y eso se refleja en la
 * flota y puede afectar a las alertas, que son de otra feature (alerts).
 */
export const usePostponeTask = (patente: string, codigoTarea: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PostponeInput) => postponeTask(patente, codigoTarea, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
