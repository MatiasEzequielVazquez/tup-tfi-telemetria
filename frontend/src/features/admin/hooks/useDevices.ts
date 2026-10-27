import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDevice, getDevices, linkDevice, unlinkDevice } from '../services/devicesAdminService'

export const useDevices = () =>
  useQuery({
    queryKey: ['admin', 'devices'],
    queryFn: ({ signal }) => getDevices(signal),
  })

/**
 * Las escrituras vuelven a pedir los datos en pantalla y la mutación sigue "en curso" hasta
 * entonces, así el formulario no se cierra con datos viejos detrás. Se invalida todo y no
 * solo este listado: vincular o desvincular cambia lo que muestran la flota, el detalle de la
 * unidad (dispositivo y carga manual de km) y el listado de unidades.
 */
export const useCreateDevice = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceUid: string) => createDevice(deviceUid),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useLinkDevice = (deviceUid: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patente: string) => linkDevice(deviceUid, patente),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useUnlinkDevice = (deviceUid: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unlinkDevice(deviceUid),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
