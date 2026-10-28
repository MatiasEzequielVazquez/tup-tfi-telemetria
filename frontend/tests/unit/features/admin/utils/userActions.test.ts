import { describe, expect, it } from 'vitest'
import type { User } from '../../../../../src/features/admin/types'
import { canDeactivateUser } from '../../../../../src/features/admin/utils/userActions'

const user = (overrides: Partial<User> = {}): User =>
  ({ email: 'ana.perez@flota.example', nombre: 'Ana Pérez', rol: 'mantenimiento', activo: true, ...overrides }) as User

describe('canDeactivateUser', () => {
  it('ofrece la baja a un usuario activo que no es quien opera', () => {
    expect(canDeactivateUser(user(), 'laura.gomez@flota.example')).toBe(true)
  })

  it('no la ofrece sobre uno mismo, sin importar mayúsculas', () => {
    expect(canDeactivateUser(user(), 'ana.perez@flota.example')).toBe(false)
    expect(canDeactivateUser(user({ email: 'Ana.Perez@Flota.Example' }), 'ana.perez@flota.example')).toBe(false)
  })

  it('no la ofrece a un usuario que ya está dado de baja', () => {
    expect(canDeactivateUser(user({ activo: false }), 'laura.gomez@flota.example')).toBe(false)
  })

  it('no la ofrece mientras no se sabe quién opera', () => {
    expect(canDeactivateUser(user(), undefined)).toBe(false)
  })
})
