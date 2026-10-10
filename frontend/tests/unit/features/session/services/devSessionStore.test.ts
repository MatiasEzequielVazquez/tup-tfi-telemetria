import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'tfi.dev-session.rol'

// El módulo lee el rol guardado al cargarse, así que cada prueba lo importa de nuevo con un
// almacenamiento propio.
const loadStore = async (stored: string | null) => {
  const storage = new Map<string, string>()
  if (stored !== null) storage.set(STORAGE_KEY, stored)
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
  })
  vi.resetModules()
  const store = await import('../../../../../src/features/session/services/devSessionStore')
  return { store, storage }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('devSessionStore', () => {
  it('usa admin cuando no hay rol guardado o el guardado no es válido', async () => {
    expect((await loadStore(null)).store.getDevRole()).toBe('admin')
    expect((await loadStore('superusuario')).store.getDevRole()).toBe('admin')
  })

  it('recupera el rol guardado y lo envía como token', async () => {
    const { store } = await loadStore('mantenimiento')

    expect(store.getDevRole()).toBe('mantenimiento')
    expect(store.getDevAccessToken()).toBe('mantenimiento')
  })

  it('persiste el cambio de rol y avisa a los suscriptores una sola vez por cambio', async () => {
    const { store, storage } = await loadStore(null)
    const listener = vi.fn()
    const unsubscribe = store.subscribeDevRole(listener)

    store.setDevRole('mantenimiento')
    store.setDevRole('mantenimiento') // mismo valor: no notifica
    unsubscribe()
    store.setDevRole('admin') // ya sin suscripción

    expect(listener).toHaveBeenCalledTimes(1)
    expect(storage.get(STORAGE_KEY)).toBe('admin')
  })
})
