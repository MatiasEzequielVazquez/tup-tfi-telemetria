import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPost,
  buildUrl,
  setAccessTokenProvider,
  setUnauthorizedHandler,
} from '../../../src/api/client'

const BASE = 'http://api.test/api/v1'

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', `${BASE}/`) // con barra final: el cliente debe normalizarla
  vi.stubGlobal('fetch', fetchMock)
  setAccessTokenProvider(() => null)
  setUnauthorizedHandler(() => {})
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('buildUrl', () => {
  it('codifica los parámetros de ruta y omite los de query vacíos', () => {
    const url = buildUrl('/unidades/{patente}/detalle', {
      pathParams: { patente: 'AB 1/2' },
      query: { page: 2, activa: false, tenencia: undefined, estado: null },
    })
    expect(url).toBe(`${BASE}/unidades/AB%201%2F2/detalle?page=2&activa=false`)
  })

  it('falla de forma explícita si falta VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', '')
    expect(() => buildUrl('/me')).toThrowError(/VITE_API_URL/)
  })
})

describe('apiPost', () => {
  it('envía el cuerpo como JSON, con los parámetros de ruta codificados, y devuelve la respuesta', async () => {
    const creado = { patente: 'AB123CD', km: 415200 }
    fetchMock.mockResolvedValue(jsonResponse(creado, { status: 201 }))

    const result = await apiPost('/unidades/{patente}/kilometraje', {
      pathParams: { patente: 'AB 123' },
      body: { km: 415200 },
    })

    const [url, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Headers
    expect(url).toBe(`${BASE}/unidades/AB%20123/kilometraje`)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"km":415200}')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(result).toEqual(creado)
  })

  it('conserva el mensaje del servidor cuando rechaza la operación (409)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'conflicto', message: 'El kilometraje no puede disminuir (RN09): el actual es 415000.' } },
        { status: 409 },
      ),
    )

    const error = await apiPost('/unidades/{patente}/kilometraje', {
      pathParams: { patente: 'AB123CD' },
      body: { km: 100 },
    }).catch((e: unknown) => e)

    expect(error).toMatchObject({
      kind: 'http',
      status: 409,
      code: 'conflicto',
      message: expect.stringContaining('RN09'),
    })
  })
})

describe('apiDelete', () => {
  it('envía un DELETE a la ruta con los parámetros codificados, sin cuerpo, y devuelve la respuesta', async () => {
    const baja = { patente: 'AB123CD', activa: false }
    fetchMock.mockResolvedValue(jsonResponse(baja))

    const result = await apiDelete('/unidades/{patente}', { pathParams: { patente: 'AB 123' } })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/unidades/AB%20123`)
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
    expect(result).toEqual(baja)
  })

  it('conserva el mensaje del servidor cuando rechaza la baja (409)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 'conflicto', message: 'La unidad tiene un dispositivo vinculado: desvinculalo antes de darla de baja.' } },
        { status: 409 },
      ),
    )

    const error = await apiDelete('/unidades/{patente}', { pathParams: { patente: 'AB123CD' } }).catch(
      (e: unknown) => e,
    )

    expect(error).toMatchObject({ status: 409, code: 'conflicto', message: expect.stringContaining('dispositivo vinculado') })
  })
})

describe('apiGet', () => {
  it('envía el token de sesión como Bearer', async () => {
    setAccessTokenProvider(() => 'mantenimiento')
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await apiGet('/me')

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer mantenimiento')
  })

  it('espera al proveedor de token cuando es asíncrono', async () => {
    setAccessTokenProvider(() => Promise.resolve('jwt-renovado'))
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await apiGet('/me')

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer jwt-renovado')
  })

  it('avisa con el token enviado cuando la API responde 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    setAccessTokenProvider(() => 'jwt-vencido')
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'no_autenticado', message: 'Token inválido o vencido.' } }, { status: 401 }),
    )

    const error = await apiGet('/me').catch((e: unknown) => e)

    expect(handler).toHaveBeenCalledExactlyOnceWith('jwt-vencido')
    expect(error).toMatchObject({ kind: 'http', status: 401, code: 'no_autenticado' })
  })

  it('no avisa si no se envió token o si el error no es un 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 'no_autenticado', message: 'x' } }, { status: 401 }))
    await apiGet('/me').catch(() => undefined) // sin token

    setAccessTokenProvider(() => 'jwt')
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 'sin_permiso', message: 'x' } }, { status: 403 }))
    await apiGet('/me').catch(() => undefined)

    expect(handler).not.toHaveBeenCalled()
  })

  it('interpreta el formato de error { error: { code, message } }', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'no_encontrado', message: 'No existe la unidad ZZ.' } }, { status: 404 }),
    )

    const error = await apiGet('/me').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'no_encontrado',
      message: 'No existe la unidad ZZ.',
    })
  })

  it('no asume JSON en una respuesta de error (ej. un 502 de proxy)', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))

    const error = await apiGet('/me').catch((e: unknown) => e)

    expect(error).toMatchObject({ kind: 'http', status: 502, code: null })
  })

  it('distingue la falta de conexión de un error HTTP', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await apiGet('/me').catch((e: unknown) => e)

    expect(error).toMatchObject({ kind: 'network', status: null })
  })

  it('deja pasar la cancelación sin convertirla en error de red', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(abort)

    await expect(apiGet('/me')).rejects.toBe(abort)
  })

  it('tolera una respuesta 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiGet('/me')).resolves.toBeUndefined()
  })

  it('rechaza un 200 sin cuerpo o con cuerpo que no es JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    await expect(apiGet('/me')).rejects.toMatchObject({ kind: 'invalid-response' })

    fetchMock.mockResolvedValueOnce(new Response('no es json', { status: 200 }))
    await expect(apiGet('/me')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
