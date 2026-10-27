import { describe, expect, it } from 'vitest'
import type { User } from '../../../../../src/features/admin/types'
import {
  buildCreateUserBody,
  buildEditUserBody,
  emptyUserValues,
  hasUserChanges,
  normalizeEmail,
  parseRol,
  removesOwnAdmin,
  userToValues,
  validateUser,
  type UserFormValues,
} from '../../../../../src/features/admin/utils/userForm'

const valid: UserFormValues = { email: 'ana.perez@flota.example', nombre: 'Ana Pérez', rol: 'mantenimiento' }
const original = { email: 'ana.perez@flota.example', nombre: 'Ana Pérez', rol: 'mantenimiento' } as User

describe('parseRol', () => {
  it('acepta los roles del contrato y trata cualquier otro valor como "sin elegir"', () => {
    expect(parseRol('admin')).toBe('admin')
    expect(parseRol('mantenimiento')).toBe('mantenimiento')
    expect(parseRol('chofer')).toBe('')
    expect(parseRol('')).toBe('')
  })
})

describe('normalizeEmail', () => {
  it('saca los espacios y pasa a minúsculas', () => {
    expect(normalizeEmail('  Ana.Perez@Flota.Example ')).toBe('ana.perez@flota.example')
  })
})

describe('validateUser (alta)', () => {
  it('acepta un usuario completo y uno con solo email y rol', () => {
    expect(validateUser(valid, { editing: false })).toEqual({})
    expect(validateUser({ ...valid, nombre: '' }, { editing: false })).toEqual({})
  })

  it('informa lo obligatorio que falta', () => {
    expect(Object.keys(validateUser(emptyUserValues(), { editing: false })).sort()).toEqual(['email', 'rol'])
  })

  it('valida el formato del email después de normalizarlo', () => {
    expect(validateUser({ ...valid, email: ' ANA@Flota.Example ' }, { editing: false })).toEqual({})
    for (const email of ['ana', 'ana@', '@flota.example', 'ana@flota', 'ana perez@flota.example']) {
      expect(validateUser({ ...valid, email }, { editing: false }).email).toMatch(/inválido/)
    }
  })

  it('limita el largo del email y del nombre', () => {
    expect(validateUser({ ...valid, email: `${'a'.repeat(95)}@b.co` }, { editing: false }).email).toBeUndefined() // 100
    expect(validateUser({ ...valid, email: `${'a'.repeat(96)}@b.co` }, { editing: false }).email).toMatch(/hasta 100/) // 101
    expect(validateUser({ ...valid, nombre: 'x'.repeat(101) }, { editing: false }).nombre).toMatch(/hasta 100/)
  })
})

describe('validateUser (edición)', () => {
  it('no pide el email: no se puede cambiar', () => {
    expect(validateUser({ ...valid, email: '' }, { editing: true })).toEqual({})
  })

  it('el rol sigue siendo obligatorio', () => {
    expect(validateUser({ ...valid, rol: '' }, { editing: true }).rol).toMatch(/Elegí el rol/)
  })
})

describe('buildCreateUserBody', () => {
  it('envía el email normalizado y omite el nombre si está vacío', () => {
    expect(buildCreateUserBody({ email: ' Ana@Flota.Example ', nombre: '  ', rol: 'admin' })).toEqual({
      email: 'ana@flota.example',
      rol: 'admin',
    })
  })

  it('envía el nombre sin espacios sobrantes', () => {
    expect(buildCreateUserBody({ ...valid, nombre: ' Ana Pérez ' })).toEqual({
      email: 'ana.perez@flota.example',
      nombre: 'Ana Pérez',
      rol: 'mantenimiento',
    })
  })
})

describe('buildEditUserBody', () => {
  it('sin cambios no hay nada para guardar', () => {
    const body = buildEditUserBody(userToValues(original), original)
    expect(body).toEqual({})
    expect(hasUserChanges(body)).toBe(false)
  })

  it('envía solo lo que cambió', () => {
    expect(buildEditUserBody({ ...userToValues(original), rol: 'admin' }, original)).toEqual({ rol: 'admin' })
    expect(buildEditUserBody({ ...userToValues(original), nombre: ' Ana P. ' }, original)).toEqual({ nombre: 'Ana P.' })
  })

  it('vaciar el nombre envía un texto vacío, que lo borra', () => {
    expect(buildEditUserBody({ ...userToValues(original), nombre: '' }, original)).toEqual({ nombre: '' })
  })

  it('un usuario sin nombre y sin cambios no envía un nombre vacío', () => {
    const sinNombre = { ...original, nombre: null } as User
    expect(buildEditUserBody(userToValues(sinNombre), sinNombre)).toEqual({})
  })
})

describe('removesOwnAdmin', () => {
  const admin = { ...original, email: 'laura.gomez@flota.example', rol: 'admin' } as User

  it('avisa cuando un administrador se quita a sí mismo el rol', () => {
    expect(removesOwnAdmin({ rol: 'mantenimiento' }, admin, 'laura.gomez@flota.example')).toBe(true)
    expect(removesOwnAdmin({ rol: 'mantenimiento' }, admin, 'Laura.Gomez@Flota.Example')).toBe(true)
  })

  it('no avisa si es otro usuario, si sigue siendo admin o si no cambia el rol', () => {
    expect(removesOwnAdmin({ rol: 'mantenimiento' }, admin, 'pablo.rinaldi@flota.example')).toBe(false)
    expect(removesOwnAdmin({ rol: 'admin' }, admin, 'laura.gomez@flota.example')).toBe(false)
    expect(removesOwnAdmin({ nombre: 'Laura' }, admin, 'laura.gomez@flota.example')).toBe(false)
    expect(removesOwnAdmin({ rol: 'admin' }, original, 'ana.perez@flota.example')).toBe(false)
  })

  it('sin saber quién es el usuario actual no avisa', () => {
    expect(removesOwnAdmin({ rol: 'mantenimiento' }, admin, undefined)).toBe(false)
  })
})
