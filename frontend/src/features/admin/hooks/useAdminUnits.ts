import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createUnit,
  deactivateUnit,
  getAdminUnits,
  updateUnit,
} from '../services/unitsAdminService'
import type { UnitEdit, UnitInput } from '../types'

/** La clave incluye la situación: activas y dadas de baja son consultas distintas. */
export const useAdminUnits = (activa: boolean) =>
  useQuery({
    queryKey: ['admin', 'units', { activa }],
    queryFn: ({ signal }) => getAdminUnits(activa, signal),
  })

/**
 * Las escrituras vuelven a pedir los datos en pantalla y la mutación sigue "en curso" hasta
 * entonces, así el formulario no se cierra con datos viejos detrás. Se invalida todo y no
 * solo este listado: una unidad nueva, editada o dada de baja se ve también en la flota y en
 * las alertas, que son de otras features.
 */
export const useCreateUnit = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UnitInput) => createUnit(input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useUpdateUnit = (patente: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UnitEdit) => updateUnit(patente, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useDeactivateUnit = (patente: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deactivateUnit(patente),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
