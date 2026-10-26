import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

// devSessionStore lee localStorage al cargarse: se importa con un almacenamiento propio.
const load = async () => {
  vi.stubGlobal('window', {
    localStorage: { getItem: () => 'mantenimiento', setItem: () => {} },
  })
  vi.resetModules()
  return import('../../../../../src/features/session/services/fixedSessions')
}

describe('createDevSession', () => {
  it('está siempre iniciada y su token es el rol simulado', async () => {
    const { createDevSession } = await load()
    const session = createDevSession()

    expect(session.mode).toBe('dev')
    expect(session.getSnapshot()).toEqual({ status: 'signed-in' })
    expect(session.getAccessToken()).toBe('mantenimiento')
  })

  it('no admite iniciar sesión', async () => {
    const { createDevSession } = await load()

    await expect(createDevSession().signIn('a@b.co', 'x')).rejects.toThrowError(/modo desarrollo/)
  })
})

describe('createInvalidSession', () => {
  it('expone el motivo y no entrega token', async () => {
    const { createInvalidSession } = await load()
    const session = createInvalidSession('Falta VITE_SUPABASE_URL.')

    expect(session.mode).toBe('invalid')
    expect(session.getSnapshot()).toEqual({ status: 'misconfigured', message: 'Falta VITE_SUPABASE_URL.' })
    expect(session.getAccessToken()).toBeNull()
  })
})
