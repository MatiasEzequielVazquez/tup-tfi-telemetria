import type { paths } from './schema'

/**
 * Cliente HTTP compartido. No conoce pantallas ni entidades: construye la URL, agrega el
 * token de sesión, envía/recibe JSON e interpreta el formato de error del contrato
 * (`{ "error": { "code", "message" } }`).
 */

export type ApiErrorKind =
  /** El servidor respondió con un estado HTTP no exitoso. */
  | 'http'
  /** No hubo respuesta (servidor caído, CORS, sin red). */
  | 'network'
  /** Respondió bien, pero el cuerpo no tiene la forma esperada. */
  | 'invalid-response'
  /** Falta configuración del frontend (por ejemplo VITE_API_URL). */
  | 'config'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** Estado HTTP; `null` si no hubo respuesta. */
  readonly status: number | null
  /** `error.code` del contrato (ej.: `no_encontrado`); `null` si la respuesta no lo traía. */
  readonly code: string | null

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; code?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status ?? null
    this.code = options.code ?? null
  }
}

/** Respuesta con forma distinta a la esperada (usada por las validaciones de cada feature). */
export function invalidResponse(message: string): ApiError {
  return new ApiError('invalid-response', `La API devolvió una respuesta inesperada: ${message}`)
}

// ---------- sesión ----------

type AccessTokenProvider = () => string | null

let accessTokenProvider: AccessTokenProvider = () => null

/**
 * Registra de dónde sale el token de cada request. Se configura una sola vez al iniciar la
 * aplicación (src/main.tsx); el cliente no sabe si el token es simulado o de Supabase.
 */
export function setAccessTokenProvider(provider: AccessTokenProvider): void {
  accessTokenProvider = provider
}

// ---------- URL ----------

export type ApiPath = keyof paths & string
type PathParams = Record<string, string | number>
type QueryParams = Record<string, string | number | boolean | null | undefined>

function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim()
  if (!raw) {
    throw new ApiError(
      'config',
      'Falta configurar VITE_API_URL. Copiá frontend/.env.example a frontend/.env y reiniciá Vite.',
    )
  }
  return raw.replace(/\/+$/, '')
}

/**
 * Arma la URL a partir de una ruta del contrato (`/unidades/{patente}/detalle`).
 * Los parámetros de ruta se codifican con `encodeURIComponent`; los de query omiten
 * `undefined` y `null`.
 */
export function buildUrl(
  path: ApiPath,
  options: { pathParams?: PathParams; query?: QueryParams } = {},
): string {
  const { pathParams = {}, query = {} } = options
  const resolved = path.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = pathParams[name]
    if (value === undefined) throw new Error(`Falta el parámetro de ruta "${name}" para ${path}`)
    return encodeURIComponent(String(value))
  })

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  const qs = search.toString()
  return `${apiBaseUrl()}${resolved}${qs ? `?${qs}` : ''}`
}

// ---------- requests ----------

export interface RequestOptions {
  pathParams?: PathParams
  query?: QueryParams
  /** Se serializa como JSON. */
  body?: unknown
  /** Permite cancelar la consulta (TanStack Query lo provee en cada queryFn). */
  signal?: AbortSignal
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function networkError(cause: unknown): ApiError {
  return new ApiError(
    'network',
    'No se pudo conectar con el servidor. Verificá que la API esté en ejecución y que VITE_API_URL sea correcta.',
    { cause },
  )
}

function readErrorBody(parsed: unknown): { code: string; message: string } | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const error = (parsed as { error?: unknown }).error
  if (typeof error !== 'object' || error === null) return null
  const { code, message } = error as { code?: unknown; message?: unknown }
  return typeof code === 'string' && typeof message === 'string' ? { code, message } : null
}

export async function apiRequest<T>(
  method: HttpMethod,
  path: ApiPath,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, options)

  const headers = new Headers({ Accept: 'application/json' })
  const token = accessTokenProvider()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let body: string | undefined
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  let response: Response
  let text: string
  try {
    response = await fetch(url, { method, headers, body, signal: options.signal })
    text = await response.text()
  } catch (cause) {
    if (isAbortError(cause)) throw cause
    throw networkError(cause)
  }

  // El cuerpo puede estar vacío o no ser JSON (proxy, 502, 204): se interpreta sin asumirlo.
  let parsed: unknown
  let parsedOk = false
  if (text.trim() !== '') {
    try {
      parsed = JSON.parse(text)
      parsedOk = true
    } catch {
      parsedOk = false
    }
  }

  if (!response.ok) {
    const apiError = readErrorBody(parsed)
    if (apiError) {
      throw new ApiError('http', apiError.message, { status: response.status, code: apiError.code })
    }
    throw new ApiError(
      'http',
      `El servidor respondió con un error inesperado (HTTP ${response.status}).`,
      { status: response.status },
    )
  }

  if (response.status === 204 || response.status === 205) return undefined as T
  if (text.trim() === '') throw invalidResponse('la respuesta no tiene contenido.')
  if (!parsedOk) throw invalidResponse('el cuerpo no es JSON válido.')
  return parsed as T
}

export function apiGet<T>(path: ApiPath, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>('GET', path, options)
}

export function apiPatch<T>(path: ApiPath, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>('PATCH', path, options)
}
