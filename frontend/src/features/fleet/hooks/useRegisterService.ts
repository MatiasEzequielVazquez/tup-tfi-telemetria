import { useMutation, useQueryClient } from '@tanstack/react-query'
import { registerService } from '../services/fleetService'
import type { ServiceInput } from '../types'

/**
 * Registro de un service de una unidad. Al confirmar el servidor se vuelven a pedir los datos
 * en pantalla y la mutación sigue "en curso" hasta entonces, así el formulario no se cierra
 * con datos viejos detrás.
 *
 * Se invalida todo y no solo el detalle: el service reinicia la cuenta de cada tarea cubierta,
 * puede adelantar el kilometraje y cambia el estado que muestra la flota; también puede
 * afectar a las alertas, que son de otra feature (alerts).
 */
export const useRegisterService = (patente: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ServiceInput) => registerService(patente, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
