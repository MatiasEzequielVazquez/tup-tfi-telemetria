import { apiGet, invalidResponse, type ApiPath, type RequestOptions } from './client'
import { expectArray, expectNumber, expectRecord } from './guards'

/** Máximo de `page_size` que admite el contrato (docs/openapi.yaml, parámetro PageSize). */
export const MAX_PAGE_SIZE = 100
/** Corte de seguridad para no iterar indefinidamente si la API devolviera datos incoherentes. */
const MAX_PAGES = 50

export interface PageResult<T> {
  items: T[]
  total: number
}

interface PageOptions {
  /** Texto para los mensajes de error, ej. "GET /unidades". */
  label: string
  query?: RequestOptions['query']
  signal?: AbortSignal
  /** Comprobación mínima de cada elemento; debe lanzar si no tiene la forma esperada. */
  checkItem?: (item: Record<string, unknown>, where: string) => void
}

/** Valida el sobre `{ data, page, page_size, total }` de un listado paginado. */
export const parsePage = <T>(
  raw: unknown,
  label: string,
  checkItem?: PageOptions['checkItem'],
): PageResult<T> => {
  const body = expectRecord(raw, label)
  const data = expectArray(body.data, `${label} › data`)
  const total = expectNumber(body.total, `${label} › total`)
  data.forEach((item, index) => {
    const where = `${label} › data[${index}]`
    const record = expectRecord(item, where)
    checkItem?.(record, where)
  })
  return { items: data as T[], total }
}

/** Una sola página de un listado paginado. */
export const getPage = async <T>(
  path: ApiPath,
  options: PageOptions & { page: number; pageSize: number },
): Promise<PageResult<T>> => {
  const raw = await apiGet<unknown>(path, {
    query: { ...options.query, page: options.page, page_size: options.pageSize },
    signal: options.signal,
  })
  return parsePage<T>(raw, options.label, options.checkItem)
}

/**
 * Todas las páginas de un listado, pidiéndolas de a MAX_PAGE_SIZE hasta reunir el `total`
 * que informa la API. Cada página recibe los mismos parámetros de filtro. Nunca devuelve
 * una página parcial como si fuera el total: si la API es incoherente, lanza.
 */
export const getAllPages = async <T>(
  path: ApiPath,
  options: PageOptions,
): Promise<PageResult<T>> => {
  const items: T[] = []
  let total = 0

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await getPage<T>(path, { ...options, page, pageSize: MAX_PAGE_SIZE })
    total = result.total
    items.push(...result.items)

    if (items.length >= total) return { items, total }
    if (result.items.length === 0) break
  }

  throw invalidResponse(
    `la API informó ${total} elementos pero solo se pudieron obtener ${items.length}.`,
  )
}
