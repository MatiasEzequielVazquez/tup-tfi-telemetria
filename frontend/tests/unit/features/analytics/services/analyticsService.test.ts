import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllAlerts, getFleetUnits } from '../../../../../src/features/analytics/services/analyticsService'
import { alert, unit } from '../fixtures'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
const urls = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)))

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://api.test/api/v1')
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('getFleetUnits', () => {
  it('pide solo las unidades activas y reúne todas las páginas', async () => {
    const first = Array.from({ length: 100 }, (_, i) => unit({ patente: `A${i}` }))
    fetchMock
      .mockResolvedValueOnce(json({ data: first, page: 1, page_size: 100, total: 101 }))
      .mockResolvedValueOnce(json({ data: [unit({ patente: 'ZZ999ZZ' })], page: 2, page_size: 100, total: 101 }))

    const units = await getFleetUnits()

    expect(units).toHaveLength(101)
    expect(urls().map((u) => [u.pathname, u.searchParams.get('activa'), u.searchParams.get('page')])).toEqual([
      ['/api/v1/unidades', 'true', '1'],
      ['/api/v1/unidades', 'true', '2'],
    ])
  })

  it('rechaza una respuesta sin km_actual numérico', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ data: [{ patente: 'AB123CD', km_actual: 'mucho' }], page: 1, page_size: 100, total: 1 }),
    )
    await expect(getFleetUnits()).rejects.toThrow(/km_actual/)
  })
})

describe('getAllAlerts', () => {
  it('trae las alertas de todos los estados, sin filtros', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ data: [alert(), alert({ estado: 'revisada' })], page: 1, page_size: 100, total: 2 }),
    )

    const alerts = await getAllAlerts()

    expect(alerts).toHaveLength(2)
    const params = urls()[0].searchParams
    expect(urls()[0].pathname).toBe('/api/v1/alertas')
    expect(params.has('estado')).toBe(false)
    expect(params.get('page_size')).toBe('100')
  })

  it('rechaza una alerta sin fecha de generación', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ data: [{ origen: 'plan', tipo: 'tarea_proxima', estado: 'abierta' }], page: 1, page_size: 100, total: 1 }),
    )
    await expect(getAllAlerts()).rejects.toThrow(/fecha_generada/)
  })
})
