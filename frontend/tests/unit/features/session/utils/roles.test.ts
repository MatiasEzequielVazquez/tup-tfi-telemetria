import { describe, expect, it } from 'vitest'
import { hasRole } from '../../../../../src/features/session/utils/roles'

describe('hasRole', () => {
  it('acepta un rol entre los permitidos', () => {
    expect(hasRole('admin', ['admin'])).toBe(true)
    expect(hasRole('mantenimiento', ['admin', 'mantenimiento'])).toBe(true)
  })

  it('rechaza un rol que no está entre los permitidos', () => {
    expect(hasRole('mantenimiento', ['admin'])).toBe(false)
  })

  it('rechaza si todavía no hay usuario o no se permite ningún rol', () => {
    expect(hasRole(undefined, ['admin'])).toBe(false)
    expect(hasRole('admin', [])).toBe(false)
  })
})
