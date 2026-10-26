import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDevice,
  getDevices,
  linkDevice,
  unlinkDevice,
} from '../../../../../src/features/admin/services/devicesAdminService'

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

describe('getDevices', () => {
  it('pide todos los dispositivos y devuelve la lista', async () => {
    const dispositivos = [
      { device_uid: 'esp32-A1', estado: 'activo', vinculacion_actual: { patente: 'AB123CD', desde: '2026-01-01T00:00:00Z' } },
      { device_uid: 'esp32-B2', estado: 'inactivo', vinculacion_actual: null },
    ]
    fetchMock.mockResolvedValueOnce(json({ data: dispositivos }))

    const result = await getDevices()

    expect(requested()).toMatchObject({ path: '/api/v1/dispositivos' })
    expect(result).toEqual(dispositivos)
  })

  it('rechaza una respuesta sin lista o con un dispositivo sin identificador', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    await expect(getDevices()).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ estado: 'activo' }] }))
    await expect(getDevices()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('createDevice', () => {
  it('envía el identificador por POST y devuelve el dispositivo creado', async () => {
    const creado = { device_uid: 'esp32-0F3A21', estado: 'inactivo', vinculacion_actual: null }
    fetchMock.mockResolvedValueOnce(json(creado, 201))

    const result = await createDevice('esp32-0F3A21')

    expect(requested()).toMatchObject({ path: '/api/v1/dispositivos', method: 'POST' })
    expect(JSON.parse(String(requested().body))).toEqual({ device_uid: 'esp32-0F3A21' })
    expect(result).toEqual(creado)
  })

  it('conserva el mensaje del servidor si ya existe (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'conflicto', message: 'Ya existe un dispositivo con ese device_uid.' } }, 409),
    )

    await expect(createDevice('esp32-0F3A21')).rejects.toMatchObject({
      status: 409,
      message: 'Ya existe un dispositivo con ese device_uid.',
    })
  })
})

describe('linkDevice', () => {
  it('vincula el dispositivo a la unidad por PATCH', async () => {
    fetchMock.mockResolvedValueOnce(json({ device_uid: 'esp32-A1', vinculacion_actual: { patente: 'AB123CD' } }))

    await linkDevice('esp32-A1', 'AB123CD')

    expect(requested()).toMatchObject({ path: '/api/v1/dispositivos/esp32-A1/vincular', method: 'PATCH' })
    expect(JSON.parse(String(requested().body))).toEqual({ patente: 'AB123CD' })
  })

  it('conserva el mensaje de RN02 cuando alguno de los dos ya está ocupado (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'conflicto', message: 'La unidad ya tiene un dispositivo vinculado (RN02).' } }, 409),
    )

    await expect(linkDevice('esp32-A1', 'AB123CD')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('RN02'),
    })
  })
})

describe('unlinkDevice', () => {
  it('desvincula el dispositivo por PATCH, con el identificador codificado y sin cuerpo', async () => {
    fetchMock.mockResolvedValueOnce(json({ device_uid: 'esp32 A1', estado: 'inactivo', vinculacion_actual: null }))

    const result = await unlinkDevice('esp32 A1')

    expect(requested()).toMatchObject({ path: '/api/v1/dispositivos/esp32%20A1/desvincular', method: 'PATCH' })
    expect(requested().body).toBeUndefined()
    expect(result).toMatchObject({ estado: 'inactivo', vinculacion_actual: null })
  })
})
