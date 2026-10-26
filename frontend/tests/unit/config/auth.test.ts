import { describe, expect, it } from 'vitest'
import { resolveAuthConfig } from '../../../src/config/auth'

const SUPABASE = {
  VITE_AUTH_MODE: 'supabase',
  VITE_SUPABASE_URL: 'https://abc.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
}

describe('resolveAuthConfig', () => {
  it('usa la sesión simulada en desarrollo y Supabase en producción cuando no se configura el modo', () => {
    expect(resolveAuthConfig({}, false)).toEqual({ mode: 'dev' })
    expect(resolveAuthConfig({ VITE_SUPABASE_URL: 'https://a.co', VITE_SUPABASE_ANON_KEY: 'k' }, true)).toEqual({
      mode: 'supabase',
      supabaseUrl: 'https://a.co',
      supabaseAnonKey: 'k',
    })
  })

  it('prohíbe la sesión simulada en un build de producción', () => {
    expect(resolveAuthConfig({ VITE_AUTH_MODE: 'dev' }, true)).toMatchObject({
      mode: 'invalid',
      message: expect.stringMatching(/producción/),
    })
  })

  it('rechaza un modo desconocido', () => {
    expect(resolveAuthConfig({ VITE_AUTH_MODE: 'basic' }, false)).toMatchObject({
      mode: 'invalid',
      message: expect.stringContaining('"basic"'),
    })
  })

  it('exige la URL y la clave de Supabase', () => {
    expect(resolveAuthConfig({ VITE_AUTH_MODE: 'supabase' }, false)).toMatchObject({ mode: 'invalid' })
    expect(resolveAuthConfig({ ...SUPABASE, VITE_SUPABASE_ANON_KEY: '  ' }, false)).toMatchObject({
      mode: 'invalid',
    })
  })

  it('rechaza una URL de Supabase que no es http(s)', () => {
    expect(resolveAuthConfig({ ...SUPABASE, VITE_SUPABASE_URL: 'abc.supabase.co' }, false)).toMatchObject({
      mode: 'invalid',
      message: expect.stringContaining('VITE_SUPABASE_URL'),
    })
  })

  it('normaliza espacios y barras finales', () => {
    expect(
      resolveAuthConfig({ ...SUPABASE, VITE_SUPABASE_URL: ' https://abc.supabase.co// ' }, false),
    ).toEqual({ mode: 'supabase', supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'anon-key' })
  })
})
