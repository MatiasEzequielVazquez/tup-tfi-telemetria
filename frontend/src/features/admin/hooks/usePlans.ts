import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assignTask, getUnit, getUnitPlans, updatePlan } from '../services/plansAdminService'
import type { PlanEdit, PlanInput } from '../types'

export const useAdminUnit = (patente: string) =>
  useQuery({
    queryKey: ['admin', 'unit', patente],
    queryFn: ({ signal }) => getUnit(patente, signal),
  })

export const useUnitPlans = (patente: string) =>
  useQuery({
    queryKey: ['admin', 'plans', patente],
    queryFn: ({ signal }) => getUnitPlans(patente, signal),
  })

/**
 * Las escrituras vuelven a pedir los datos en pantalla y la mutación sigue "en curso" hasta
 * entonces, así el formulario no se cierra con datos viejos detrás. Se invalida todo y no
 * solo este plan: asignar una tarea o cambiar su intervalo recalcula el estado, que también
 * muestran la flota, el detalle de la unidad y las alertas.
 */
export const useAssignTask = (patente: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlanInput) => assignTask(patente, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useUpdatePlan = (patente: string, codigoTarea: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlanEdit) => updatePlan(patente, codigoTarea, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
