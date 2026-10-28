import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignTask,
  getUnit,
  getUnitPlans,
  updatePlan,
} from '../../../../../src/features/admin/services/plansAdminService'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const requested = () => {
  const [url, init] = fetchMock.mock.calls[0]
  return { path: new URL(String(url)).pathname, method: init?.method, body: init?.body }
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

const plan = {
  codigo_tarea: 'ACEITE_MOTOR',
  nombre: 'Cambio de aceite de motor',
  intervalo_km: 40000,
  umbral_aviso_km: 4000,
  activo: true,
}

describe('getUnit', () => {
  it('pide los datos básicos de la unidad', async () => {
    fetchMock.mockResolvedValueOnce(json({ patente: 'AB 123', km_actual: 415000 }))

    const unit = await getUnit('AB 123')

    expect(requested().path).toBe('/api/v1/unidades/AB%20123')
    expect(unit).toMatchObject({ km_actual: 415000 })
  })

  it('rechaza una unidad sin patente o sin km actual', async () => {
    fetchMock.mockResolvedValueOnce(json({ km_actual: 1 }))
    await expect(getUnit('X')).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ patente: 'X' }))
    await expect(getUnit('X')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('getUnitPlans', () => {
  it('pide los planes de la unidad y devuelve la lista', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [plan] }))

    const result = await getUnitPlans('AB123CD')

    expect(requested().path).toBe('/api/v1/unidades/AB123CD/planes')
    expect(result).toEqual([plan])
  })

  it('incluye los planes dados de baja', async () => {
    const baja = { ...plan, codigo_tarea: 'ACEITE_CAJA', activo: false }
    fetchMock.mockResolvedValueOnce(json({ data: [plan, baja] }))

    expect(await getUnitPlans('AB123CD')).toEqual([plan, baja])
  })

  it('rechaza un plan sin código de tarea, sin intervalo o sin estado', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ intervalo_km: 1, activo: true }] }))
    await expect(getUnitPlans('X')).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ codigo_tarea: 'A', activo: true }] }))
    await expect(getUnitPlans('X')).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ codigo_tarea: 'A', intervalo_km: 1 }] }))
    await expect(getUnitPlans('X')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('assignTask', () => {
  it('asigna la tarea a la unidad por POST y devuelve el plan creado', async () => {
    fetchMock.mockResolvedValueOnce(json(plan, 201))

    const result = await assignTask('AB123CD', { codigo_tarea: 'ACEITE_MOTOR', intervalo_km: 40000, umbral_aviso_km: 4000 })

    expect(requested()).toMatchObject({ path: '/api/v1/unidades/AB123CD/planes', method: 'POST' })
    expect(JSON.parse(String(requested().body))).toEqual({
      codigo_tarea: 'ACEITE_MOTOR',
      intervalo_km: 40000,
      umbral_aviso_km: 4000,
    })
    expect(result).toEqual(plan)
  })

  it('conserva el mensaje del servidor si la unidad ya tiene la tarea (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'conflicto', message: 'La unidad ya tiene asignada esa tarea.' } }, 409),
    )

    await expect(assignTask('AB123CD', { codigo_tarea: 'ACEITE_MOTOR' })).rejects.toMatchObject({
      status: 409,
      message: 'La unidad ya tiene asignada esa tarea.',
    })
  })
})

describe('updatePlan', () => {
  it('cambia el plan por PATCH, con la patente y el código codificados en la ruta', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...plan, intervalo_km: 60000 }))

    const result = await updatePlan('AB 123', 'TAREA/X', { intervalo_km: 60000 })

    expect(requested()).toMatchObject({ path: '/api/v1/unidades/AB%20123/planes/TAREA%2FX', method: 'PATCH' })
    expect(JSON.parse(String(requested().body))).toEqual({ intervalo_km: 60000 })
    expect(result).toMatchObject({ intervalo_km: 60000 })
  })

  it('da de baja y reactiva con `activo`', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...plan, activo: false }))
    expect(await updatePlan('AB123CD', 'ACEITE_MOTOR', { activo: false })).toMatchObject({ activo: false })
    expect(JSON.parse(String(requested().body))).toEqual({ activo: false })

    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(json(plan))
    expect(await updatePlan('AB123CD', 'ACEITE_MOTOR', { activo: true })).toMatchObject({ activo: true })
    expect(JSON.parse(String(requested().body))).toEqual({ activo: true })
  })

  it('conserva el mensaje del servidor si la tarea está dada de baja en el catálogo (400)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'validacion', message: 'La tarea está dada de baja en el catálogo.' } }, 400),
    )

    await expect(updatePlan('AB123CD', 'ACEITE_MOTOR', { activo: true })).rejects.toMatchObject({
      status: 400,
      message: 'La tarea está dada de baja en el catálogo.',
    })
  })
})
