import { apiGet } from '../../../api/client'
import { expectArray, expectRecord, expectString } from '../../../api/guards'
import { getAllPages } from '../../../api/pagination'
import type { DetalleUnidad, UnidadResumen } from '../../../api/types'
import { fleetFiltersToQuery, type FleetFilters } from '../utils/filters'

export interface Fleet {
  unidades: UnidadResumen[]
  /** Total informado por la API para esos filtros; coincide con `unidades.length`. */
  total: number
}

/**
 * GET /unidades — la flota que coincide con los filtros, completa.
 *
 * El listado es paginado (máximo 100 por página). Cada página se pide con los mismos
 * filtros y se sigue hasta reunir el `total` que informa la API: el filtrado lo hace el
 * servidor, nunca sobre unidades ya descargadas, y no se presenta una página parcial como
 * si fuera el resultado. Con el tamaño previsto de la flota (≤ 50 unidades, RNF06) es una
 * sola request.
 */
export const getFleet = async (filters: FleetFilters, signal?: AbortSignal): Promise<Fleet> => {
  const { items, total } = await getAllPages<UnidadResumen>('/unidades', {
    label: 'GET /unidades',
    query: fleetFiltersToQuery(filters),
    signal,
    checkItem: (unidad, where) => expectString(unidad.patente, `${where}.patente`),
  })
  return { unidades: items, total }
}

/** GET /unidades/{patente}/detalle — unidad, dispositivo vigente, planes y fallas activas. */
export const getUnitDetail = async (
  patente: string,
  signal?: AbortSignal,
): Promise<DetalleUnidad> => {
  const raw = expectRecord(
    await apiGet<unknown>('/unidades/{patente}/detalle', { pathParams: { patente }, signal }),
    'GET /unidades/{patente}/detalle',
  )
  expectRecord(raw.unidad, 'detalle › unidad')
  expectArray(raw.planes, 'detalle › planes')
  expectArray(raw.fallas_activas, 'detalle › fallas_activas')
  if (raw.dispositivo !== null) expectRecord(raw.dispositivo, 'detalle › dispositivo')
  return raw as unknown as DetalleUnidad
}
