import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createUnit,
  deactivateUnit,
  getAdminUnits,
  updateUnit,
} from '../../../../../src/features/admin/services/unitsAdminService'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

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

describe('getAdminUnits', () => {
  it('pide las unidades de la situación pedida, completas, y devuelve la lista', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ data: [{ patente: 'AAA111' }, { patente: 'BBB222' }], page: 1, page_size: 100, total: 2 }),
    )

    const units = await getAdminUnits(false)

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/api/v1/unidades')
    expect(url.searchParams.get('activa')).toBe('false')
    expect(url.searchParams.get('page_size')).toBe('100')
    expect(units.map((u) => u.patente)).toEqual(['AAA111', 'BBB222'])
  })

  it('rechaza una unidad sin patente', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ marca: 'Scania' }], page: 1, page_size: 100, total: 1 }))

    await expect(getAdminUnits(true)).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('createUnit', () => {
  it('envía el alta por POST y devuelve la unidad creada', async () => {
    const creada = { patente: 'AB123CD', marca: 'Scania', activa: true }
    fetchMock.mockResolvedValueOnce(json(creada, 201))

    const result = await createUnit({ patente: 'AB123CD', marca: 'Scania', tenencia: 'propia', protocolo: 'J1939' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/unidades')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      patente: 'AB123CD',
      marca: 'Scania',
      tenencia: 'propia',
      protocolo: 'J1939',
    })
    expect(result).toEqual(creada)
  })

  it('conserva el mensaje del servidor si la patente ya existe (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'conflicto', message: 'Ya existe una unidad con esa patente.' } }, 409),
    )

    await expect(
      createUnit({ patente: 'AB123CD', marca: 'Scania', tenencia: 'propia', protocolo: 'J1939' }),
    ).rejects.toMatchObject({ status: 409, message: 'Ya existe una unidad con esa patente.' })
  })
})

describe('updateUnit', () => {
  it('envía solo los campos indicados por PATCH a la unidad', async () => {
    fetchMock.mockResolvedValueOnce(json({ patente: 'AB 123', marca: 'Volvo' }))

    await updateUnit('AB 123', { marca: 'Volvo' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/unidades/AB%20123')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ marca: 'Volvo' })
  })
})

describe('deactivateUnit', () => {
  it('da de baja con DELETE y devuelve la unidad', async () => {
    fetchMock.mockResolvedValueOnce(json({ patente: 'AB123CD', activa: false }))

    const result = await deactivateUnit('AB123CD')

    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/unidades/AB123CD')
    expect(init?.method).toBe('DELETE')
    expect(result).toMatchObject({ activa: false })
  })

  it('conserva el mensaje del servidor si la unidad tiene un dispositivo vinculado (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        { error: { code: 'conflicto', message: 'La unidad tiene un dispositivo vinculado: desvinculalo antes de darla de baja.' } },
        409,
      ),
    )

    await expect(deactivateUnit('AB123CD')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('dispositivo vinculado'),
    })
  })
})
