import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../../../src/api/client'
import { getFleet, getUnitDetail } from '../../../../../src/features/fleet/services/fleetService'
import { DEFAULT_FLEET_FILTERS } from '../../../../../src/features/fleet/utils/filters'

const unidad = (patente: string) => ({
  patente,
  marca: 'Scania',
  modelo: 'P 360',
  estado_mantenimiento: null,
  dispositivo: null,
})

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const pagina = (patentes: string[], numero: number, total: number): Response =>
  json({ data: patentes.map(unidad), page: numero, page_size: 100, total })

const requestedUrls = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)))

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

describe('getFleet', () => {
  it('pide páginas de 100 hasta reunir todo el total que informa la API', async () => {
    fetchMock
      .mockResolvedValueOnce(pagina(['AAA111', 'BBB222'], 1, 3))
      .mockResolvedValueOnce(pagina(['CCC333'], 2, 3))

    const flota = await getFleet(DEFAULT_FLEET_FILTERS)

    expect(flota.unidades.map((u) => u.patente)).toEqual(['AAA111', 'BBB222', 'CCC333'])
    expect(flota.total).toBe(3)
    expect(requestedUrls().map((u) => u.searchParams.get('page'))).toEqual(['1', '2'])
    expect(requestedUrls().every((u) => u.searchParams.get('page_size') === '100')).toBe(true)
  })

  it('envía los mismos filtros en cada página y los resuelve el servidor', async () => {
    fetchMock
      .mockResolvedValueOnce(pagina(['AAA111', 'BBB222'], 1, 3))
      .mockResolvedValueOnce(pagina(['CCC333'], 2, 3))

    await getFleet({ tenencia: 'fletero', estado: 'con_fallas', activa: false })

    for (const url of requestedUrls()) {
      expect(url.pathname).toBe('/api/v1/unidades')
      expect(url.searchParams.get('tenencia')).toBe('fletero')
      expect(url.searchParams.get('estado')).toBe('con_fallas')
      expect(url.searchParams.get('activa')).toBe('false')
    }
  })

  it('no envía los filtros que están en "todos" y manda activa=true por defecto', async () => {
    fetchMock.mockResolvedValueOnce(pagina([], 1, 0))

    await getFleet(DEFAULT_FLEET_FILTERS)

    const params = requestedUrls()[0].searchParams
    expect(params.has('tenencia')).toBe(false)
    expect(params.has('estado')).toBe(false)
    expect(params.get('activa')).toBe('true')
  })

  it('no devuelve una página parcial como si fuera la flota completa', async () => {
    fetchMock.mockResolvedValueOnce(pagina(['AAA111'], 1, 5)).mockResolvedValueOnce(pagina([], 2, 5))

    const error = await getFleet(DEFAULT_FLEET_FILTERS).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'invalid-response' })
  })

  it('devuelve una flota vacía cuando la API informa total 0', async () => {
    fetchMock.mockResolvedValueOnce(pagina([], 1, 0))

    await expect(getFleet(DEFAULT_FLEET_FILTERS)).resolves.toEqual({ unidades: [], total: 0 })
  })
})

describe('getUnitDetail', () => {
  it('codifica la patente en la ruta', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ unidad: { patente: 'A/B' }, dispositivo: null, planes: [], fallas_activas: [] }),
    )

    await getUnitDetail('A/B')

    expect(String(fetchMock.mock.calls[0][0])).toBe('http://api.test/api/v1/unidades/A%2FB/detalle')
  })

  it('rechaza un detalle al que le falta una sección que la pantalla necesita', async () => {
    fetchMock.mockResolvedValueOnce(json({ unidad: { patente: 'AAA111' }, dispositivo: null }))

    await expect(getUnitDetail('AAA111')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
