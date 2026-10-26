import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPostponementHistory,
  getServiceHistory,
} from '../../../../../src/features/fleet/services/historyService'
import { DEFAULT_HISTORY_FILTERS } from '../../../../../src/features/fleet/utils/history'

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const requestedUrl = () => new URL(String(fetchMock.mock.calls[0][0]))

const queryOf = (url: URL): Record<string, string> => {
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })
  return query
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://api.test/api/v1')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('getServiceHistory', () => {
  it('pide la página de la unidad con el período, y devuelve los items y el total', async () => {
    const service = { patente: 'AB123CD', fecha: '2026-10-07', km: 1, tareas: [] }
    fetchMock.mockResolvedValueOnce(json({ data: [service], page: 2, page_size: 10, total: 11 }))

    const result = await getServiceHistory('AB 123', {
      ...DEFAULT_HISTORY_FILTERS,
      desde: '2026-01-01',
      hasta: '2026-06-30',
      servicesPage: 2,
      postponementsPage: 5, // no corresponde a esta lista
    })

    const url = requestedUrl()
    expect(url.pathname).toBe('/api/v1/unidades/AB%20123/services')
    expect(queryOf(url)).toEqual({
      desde: '2026-01-01',
      hasta: '2026-06-30',
      page: '2',
      page_size: '10',
    })
    expect(result).toEqual({ items: [service], total: 11 })
  })

  it('sin período no envía desde ni hasta', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], page: 1, page_size: 10, total: 0 }))

    await getServiceHistory('AB123CD', DEFAULT_HISTORY_FILTERS)

    expect(Object.keys(queryOf(requestedUrl())).sort()).toEqual(['page', 'page_size'])
  })

  it('rechaza un service sin fecha o sin lista de tareas', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ patente: 'X', tareas: [] }], total: 1 }))
    await expect(getServiceHistory('X', DEFAULT_HISTORY_FILTERS)).rejects.toMatchObject({
      kind: 'invalid-response',
    })

    fetchMock.mockResolvedValueOnce(json({ data: [{ patente: 'X', fecha: '2026-10-07' }], total: 1 }))
    await expect(getServiceHistory('X', DEFAULT_HISTORY_FILTERS)).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })
})

describe('getPostponementHistory', () => {
  it('pide la página de postergaciones con su propia página', async () => {
    const postergacion = { codigo_tarea: 'ACEITE_MOTOR', km_limite_nuevo: 419000, cerrada: false }
    fetchMock.mockResolvedValueOnce(json({ data: [postergacion], page: 3, page_size: 10, total: 21 }))

    const result = await getPostponementHistory('AB123CD', {
      ...DEFAULT_HISTORY_FILTERS,
      servicesPage: 9, // no corresponde a esta lista
      postponementsPage: 3,
    })

    const url = requestedUrl()
    expect(url.pathname).toBe('/api/v1/unidades/AB123CD/postergaciones')
    expect(url.searchParams.get('page')).toBe('3')
    expect(result).toEqual({ items: [postergacion], total: 21 })
  })

  it('rechaza una postergación sin tarea o sin nuevo límite', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ km_limite_nuevo: 1 }], total: 1 }))
    await expect(getPostponementHistory('X', DEFAULT_HISTORY_FILTERS)).rejects.toMatchObject({
      kind: 'invalid-response',
    })

    fetchMock.mockResolvedValueOnce(json({ data: [{ codigo_tarea: 'A' }], total: 1 }))
    await expect(getPostponementHistory('X', DEFAULT_HISTORY_FILTERS)).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })
})
