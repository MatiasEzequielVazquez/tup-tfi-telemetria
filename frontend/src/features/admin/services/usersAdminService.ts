import { apiGet, apiPatch, apiPost } from '../../../api/client'
import { expectArray, expectBoolean, expectRecord, expectString } from '../../../api/guards'
import type { User, UserEdit, UserInput } from '../types'

const checkUser = (raw: unknown, where: string): User => {
  const user = expectRecord(raw, where)
  expectString(user.email, `${where} › email`)
  expectString(user.rol, `${where} › rol`)
  expectBoolean(user.activo, `${where} › activo`)
  return user as unknown as User
}

/** GET /usuarios — todos los usuarios con su rol (RF17). El listado no es paginado. */
export const getUsers = async (signal?: AbortSignal): Promise<User[]> => {
  const body = expectRecord(await apiGet<unknown>('/usuarios', { signal }), 'GET /usuarios')
  return expectArray(body.data, 'GET /usuarios › data').map((item, index) =>
    checkUser(item, `GET /usuarios › data[${index}]`),
  )
}

/**
 * POST /usuarios — alta (RF17, RN11). El usuario ya debe existir en Supabase Auth: acá solo se
 * le asigna el rol. 409 si ya está dado de alta.
 */
export const createUser = async (input: UserInput, signal?: AbortSignal): Promise<User> =>
  checkUser(await apiPost<unknown>('/usuarios', { body: input, signal }), 'POST /usuarios')

/**
 * PATCH /usuarios/{email} — cambia el nombre o el rol, o lo da de baja o lo reactiva (`activo`,
 * RF17). 409 si deja al sistema sin administradores activos o si el administrador se da de baja
 * a sí mismo.
 */
export const updateUser = async (email: string, input: UserEdit, signal?: AbortSignal): Promise<User> =>
  checkUser(
    await apiPatch<unknown>('/usuarios/{email}', { pathParams: { email }, body: input, signal }),
    'PATCH /usuarios/{email}',
  )
