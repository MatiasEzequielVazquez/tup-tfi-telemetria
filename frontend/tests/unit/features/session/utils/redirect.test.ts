import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REDIRECT,
  readRedirectPath,
  redirectState,
} from '../../../../../src/features/session/utils/redirect'

describe('readRedirectPath', () => {
  it('vuelve a la pantalla a la que se quería entrar, con sus filtros', () => {
    const state = redirectState('/alertas?estado=revisada&page=2')
    expect(readRedirectPath(state)).toBe('/alertas?estado=revisada&page=2')
  })

  it('usa la pantalla por defecto si se entró directo al login', () => {
    expect(readRedirectPath(undefined)).toBe(DEFAULT_REDIRECT)
    expect(readRedirectPath(null)).toBe(DEFAULT_REDIRECT)
    expect(readRedirectPath({})).toBe(DEFAULT_REDIRECT)
  })

  it('ignora destinos que no son rutas internas', () => {
    for (const from of ['https://sitio.externo', '//sitio.externo', '/\\sitio.externo', 'alertas', 42]) {
      expect(readRedirectPath({ from })).toBe(DEFAULT_REDIRECT)
    }
  })

  it('no vuelve al login después de iniciar sesión', () => {
    expect(readRedirectPath(redirectState('/login'))).toBe(DEFAULT_REDIRECT)
    expect(readRedirectPath(redirectState('/login?x=1'))).toBe(DEFAULT_REDIRECT)
  })
})
