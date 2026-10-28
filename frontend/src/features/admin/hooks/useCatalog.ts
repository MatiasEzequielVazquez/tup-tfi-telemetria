import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCatalogTask, getCatalog, updateCatalogTask } from '../services/catalogAdminService'
import type { CatalogTaskEdit, CatalogTaskInput } from '../types'

/** Todo el catálogo, o con `activa: true` solo las tareas que se pueden asignar a una unidad. */
export const useCatalog = (filter: { activa?: boolean } = {}) =>
  useQuery({
    queryKey: ['admin', 'catalog', filter.activa ?? 'todas'],
    queryFn: ({ signal }) => getCatalog(filter, signal),
  })

/**
 * Al confirmar el servidor se vuelven a pedir los datos en pantalla y la mutación sigue "en
 * curso" hasta entonces, así el formulario no se cierra con datos viejos detrás. Se invalida
 * todo y no solo el catálogo: dar de baja una tarea cambia lo que se ofrece al asignarla.
 */
export const useCreateCatalogTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogTaskInput) => createCatalogTask(input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useUpdateCatalogTask = (codigo: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogTaskEdit) => updateCatalogTask(codigo, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
