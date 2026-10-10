import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAlerts, getUnitOptions, reviewAlert } from '../../../../../src/features/alerts/services/alertsService'
import type { Alerta } from '../../../../../src/features/alerts/types'
import { DEFAULT_ALERT_FILTERS } from '../../../../../src/features/alerts/utils/filters'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const alerta = (overrides: Partial<Alerta> = {}): Alerta => ({
  origen: 'dispositivo',
  tipo: 'dispositivo_sin_reportar',
  patente: 'GR482NY',
  referencia: 'esp32-AAAAAA',
  referencia_nombre: null,
  fecha_generada: '2026-10-03T12:00:00Z',
  fecha_revisada: null,
  estado: 'abierta',
  clave: { device_uid: 'esp32-AAAAAA', fecha_generada: '2026-10-03T12:00:00Z' },
  ...overrides,
})

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

describe('getAlerts', () => {
  it('pide la página y los filtros al servidor y devuelve el total del resultado filtrado', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [alerta()], page: 2, page_size: 20, total: 41 }))

    const result = await getAlerts({ estado: 'revisada', tipo: 'falla_nueva', patente: 'GR482NY', page: 2 })

    const params = urls()[0].searchParams
    expect(urls()[0].pathname).toBe('/api/v1/alertas')
    const read = (names: string[]) => Object.fromEntries(names.map((name) => [name, params.get(name)]))
    expect(read(['estado', 'tipo', 'patente', 'page', 'page_size'])).toEqual({
      estado: 'revisada',
      tipo: 'falla_nueva',
      patente: 'GR482NY',
      page: '2',
      page_size: '20',
    })
    expect(result.total).toBe(41)
    expect(result.items).toHaveLength(1)
  })

  it('con el estado "todas" no envía el parámetro estado', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [], page: 1, page_size: 20, total: 0 }))

    await getAlerts({ ...DEFAULT_ALERT_FILTERS, estado: 'todas' })

    expect(urls()[0].searchParams.has('estado')).toBe(false)
  })
})

describe('reviewAlert', () => {
  it('envía PATCH con el cuerpo { origen, ...clave } y devuelve la alerta confirmada', async () => {
    const confirmada = alerta({ estado: 'revisada', fecha_revisada: '2026-10-07T15:00:00Z' })
    fetchMock.mockResolvedValueOnce(json(confirmada))

    const result = await reviewAlert(alerta())

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://api.test/api/v1/alertas/revisar')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({
      origen: 'dispositivo',
      device_uid: 'esp32-AAAAAA',
      fecha_generada: '2026-10-03T12:00:00Z',
    })
    expect(result.estado).toBe('revisada')
  })

  it('propaga el mensaje de validación del servidor', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'no_encontrado', message: 'No existe esa alerta.' } }, 404),
    )

    await expect(reviewAlert(alerta())).rejects.toMatchObject({
      status: 404,
      code: 'no_encontrado',
      message: 'No existe esa alerta.',
    })
  })

  it('no envía nada si la alerta no trae su clave completa', async () => {
    await expect(reviewAlert(alerta({ clave: { device_uid: 'x' } }))).rejects.toThrow(/fecha_generada/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getUnitOptions', () => {
  it('reúne unidades activas y dadas de baja, desde la API y ordenadas', async () => {
    fetchMock.mockImplementation(async (input) => {
      const activa = new URL(String(input)).searchParams.get('activa')
      const data =
        activa === 'true'
          ? [{ patente: 'ZZ999ZZ', activa: true }, { patente: 'AA111AA', activa: true }]
          : [{ patente: 'CJ411PJ', activa: false }]
      return json({ data, page: 1, page_size: 100, total: data.length })
    })

    const options = await getUnitOptions()

    expect(options).toEqual([
      { patente: 'AA111AA', activa: true },
      { patente: 'CJ411PJ', activa: false },
      { patente: 'ZZ999ZZ', activa: true },
    ])
    expect(urls().map((u) => u.searchParams.get('activa')).sort()).toEqual(['false', 'true'])
  })
})
