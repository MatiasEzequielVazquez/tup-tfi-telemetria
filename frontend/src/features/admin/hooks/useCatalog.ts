import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCatalogTask, getCatalog } from '../services/catalogAdminService'
import type { CatalogTaskInput } from '../types'

export const useCatalog = () =>
  useQuery({
    queryKey: ['admin', 'catalog'],
    queryFn: ({ signal }) => getCatalog(signal),
  })

/**
 * Al confirmar el servidor se vuelven a pedir los datos en pantalla y la mutación sigue "en
 * curso" hasta entonces, así el formulario no se cierra con datos viejos detrás.
 */
export const useCreateCatalogTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CatalogTaskInput) => createCatalogTask(input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
