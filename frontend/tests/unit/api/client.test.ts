import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiGet, buildUrl, setAccessTokenProvider } from '../../../src/api/client'

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

describe('apiGet', () => {
  it('envía el token de sesión como Bearer', async () => {
    setAccessTokenProvider(() => 'mantenimiento')
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await apiGet('/me')

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer mantenimiento')
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
