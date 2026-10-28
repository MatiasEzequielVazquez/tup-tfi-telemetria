import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCatalogTask,
  getCatalog,
  updateCatalogTask,
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
      { codigo: 'ACEITE_MOTOR', nombre: 'Cambio de aceite de motor', intervalo_km_default: 40000, umbral_aviso_km_default: 4000, activa: true },
      { codigo: 'SECADOR_AIRE', nombre: 'Filtro secador de aire de frenos', intervalo_km_default: 100000, umbral_aviso_km_default: 4000, activa: false },
    ]
    fetchMock.mockResolvedValueOnce(json({ data: tareas }))

    const result = await getCatalog()

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.pathname).toBe('/api/v1/tareas-catalogo')
    expect(url.search).toBe('')
    expect(result).toEqual(tareas)
  })

  it('con `activa: true` pide solo las tareas que se pueden asignar', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [] }))

    await getCatalog({ activa: true })

    expect(new URL(String(fetchMock.mock.calls[0][0])).search).toBe('?activa=true')
  })

  it('rechaza una respuesta sin lista o con una tarea sin código o sin estado', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    await expect(getCatalog()).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ nombre: 'Sin código', activa: true }] }))
    await expect(getCatalog()).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ codigo: 'A', nombre: 'Sin estado' }] }))
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
    fetchMock.mockResolvedValueOnce(json({ ...input, activa: true }, 201))

    const result = await createCatalogTask(input)

    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/tareas-catalogo')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(input)
    expect(result).toEqual({ ...input, activa: true })
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

describe('updateCatalogTask', () => {
  const tarea = {
    codigo: 'FILTRO_AIRE',
    nombre: 'Filtro de aire',
    intervalo_km_default: 80000,
    umbral_aviso_km_default: 4000,
    activa: true,
  }

  it('edita la tarea por PATCH, con el código codificado en la ruta', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...tarea, intervalo_km_default: 90000 }))

    const result = await updateCatalogTask('FILTRO/AIRE', { intervalo_km_default: 90000 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/v1/tareas-catalogo/FILTRO%2FAIRE')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ intervalo_km_default: 90000 })
    expect(result).toMatchObject({ intervalo_km_default: 90000 })
  })

  it('da de baja y reactiva con `activa`', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...tarea, activa: false }))
    expect(await updateCatalogTask(tarea.codigo, { activa: false })).toMatchObject({ activa: false })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ activa: false })

    fetchMock.mockResolvedValueOnce(json(tarea))
    expect(await updateCatalogTask(tarea.codigo, { activa: true })).toMatchObject({ activa: true })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ activa: true })
  })

  it('conserva el mensaje del servidor si la tarea no existe (404)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'no_encontrado', message: 'No existe la tarea FILTRO_AIRE.' } }, 404),
    )

    await expect(updateCatalogTask('FILTRO_AIRE', { activa: false })).rejects.toMatchObject({
      status: 404,
      message: 'No existe la tarea FILTRO_AIRE.',
    })
  })
})
