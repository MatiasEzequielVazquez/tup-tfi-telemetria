import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCatalogTask,
  getCatalog,
} from '../../../../../src/features/admin/services/catalogAdminService'

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

describe('getCatalog', () => {
  it('pide el catálogo y devuelve la lista de tareas', async () => {
    const tareas = [
      { codigo: 'ACEITE_MOTOR', nombre: 'Cambio de aceite de motor', intervalo_km_default: 40000, umbral_aviso_km_default: 4000 },
      { codigo: 'SECADOR_AIRE', nombre: 'Filtro secador de aire de frenos', intervalo_km_default: 100000, umbral_aviso_km_default: 4000 },
    ]
    fetchMock.mockResolvedValueOnce(json({ data: tareas }))

    const result = await getCatalog()

    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/tareas-catalogo')
    expect(result).toEqual(tareas)
  })

  it('rechaza una respuesta sin lista o con una tarea sin código', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    await expect(getCatalog()).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ nombre: 'Sin código' }] }))
    await expect(getCatalog()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('createCatalogTask', () => {
  const input = {
    codigo: 'FILTRO_AIRE',
    nombre: 'Filtro de aire',
    intervalo_km_default: 80000,
    umbral_aviso_km_default: 4000,
  }

  it('envía la tarea por POST y devuelve la creada', async () => {
    fetchMock.mockResolvedValueOnce(json(input, 201))

    const result = await createCatalogTask(input)

    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/tareas-catalogo')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(input)
    expect(result).toEqual(input)
  })

  it('conserva el mensaje del servidor si el código ya existe (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'conflicto', message: 'Ya existe una tarea con ese código.' } }, 409),
    )

    await expect(createCatalogTask(input)).rejects.toMatchObject({
      status: 409,
      message: 'Ya existe una tarea con ese código.',
    })
  })
})
