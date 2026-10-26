import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, getUsers, updateUser } from '../services/usersAdminService'
import type { UserEdit, UserInput } from '../types'

export const useUsers = () =>
  useQuery({
    queryKey: ['admin', 'users'],
    queryFn: ({ signal }) => getUsers(signal),
  })

/**
 * Las escrituras vuelven a pedir los datos en pantalla y la mutación sigue "en curso" hasta
 * entonces, así el formulario no se cierra con datos viejos detrás. Se invalida todo y no
 * solo este listado: si se cambia el rol del propio usuario, el encabezado y lo que puede ver
 * tienen que actualizarse.
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UserInput) => createUser(input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export const useUpdateUser = (email: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UserEdit) => updateUser(email, input),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
