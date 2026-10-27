import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createUser,
  getUsers,
  updateUser,
} from '../../../../../src/features/admin/services/usersAdminService'

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

const ana = { email: 'ana.perez@flota.example', nombre: 'Ana Pérez', rol: 'mantenimiento', created_at: '2026-01-01T00:00:00Z' }

describe('getUsers', () => {
  it('pide los usuarios y devuelve la lista', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [ana] }))

    const result = await getUsers()

    expect(requested().path).toBe('/api/v1/usuarios')
    expect(result).toEqual([ana])
  })

  it('rechaza una respuesta sin lista o con un usuario sin email o sin rol', async () => {
    fetchMock.mockResolvedValueOnce(json({}))
    await expect(getUsers()).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ rol: 'admin' }] }))
    await expect(getUsers()).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(json({ data: [{ email: 'a@b.co' }] }))
    await expect(getUsers()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('createUser', () => {
  it('envía el alta por POST y devuelve el usuario creado', async () => {
    fetchMock.mockResolvedValueOnce(json(ana, 201))

    const result = await createUser({ email: ana.email, nombre: ana.nombre, rol: 'mantenimiento' })

    expect(requested()).toMatchObject({ path: '/api/v1/usuarios', method: 'POST' })
    expect(JSON.parse(String(requested().body))).toEqual({
      email: ana.email,
      nombre: ana.nombre,
      rol: 'mantenimiento',
    })
    expect(result).toEqual(ana)
  })

  it('conserva el mensaje del servidor si el usuario ya existe (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'conflicto', message: 'Ya existe un usuario con ese email.' } }, 409),
    )

    await expect(createUser({ email: ana.email, rol: 'admin' })).rejects.toMatchObject({
      status: 409,
      message: 'Ya existe un usuario con ese email.',
    })
  })
})

describe('updateUser', () => {
  it('cambia el usuario por PATCH, con el email codificado en la ruta', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...ana, rol: 'admin' }))

    const result = await updateUser('ana+prueba@flota.example', { rol: 'admin' })

    expect(requested()).toMatchObject({ path: '/api/v1/usuarios/ana%2Bprueba%40flota.example', method: 'PATCH' })
    expect(JSON.parse(String(requested().body))).toEqual({ rol: 'admin' })
    expect(result).toMatchObject({ rol: 'admin' })
  })

  it('conserva el mensaje del servidor si deja al sistema sin administradores (409)', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        { error: { code: 'conflicto', message: 'No se puede quitar el rol admin al único administrador.' } },
        409,
      ),
    )

    await expect(updateUser('laura.gomez@flota.example', { rol: 'mantenimiento' })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('único administrador'),
    })
  })
})
