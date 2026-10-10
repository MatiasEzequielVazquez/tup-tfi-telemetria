import type { paths } from '../../../api/schema'
import type { Tenencia } from '../../../api/types'

/** Valores de `estado` que admite GET /unidades (enum del contrato). */
type UnidadesQuery = NonNullable<paths['/unidades']['get']['parameters']['query']>
export type FleetStateFilter = NonNullable<UnidadesQuery['estado']>

// Un Record sobre la unión obliga a cubrir todos los valores del contrato: si el contrato
// agrega o quita uno, esto deja de compilar. El orden es el del selector.
export const STATE_FILTER_LABELS: Record<FleetStateFilter, string> = {
  al_dia: 'Al día',
  proxima: 'Próxima',
  vencida: 'Vencida',
  postergada: 'Postergada',
  con_fallas: 'Con fallas',
  sin_reportar: 'Sin reportar',
  sin_dispositivo: 'Sin dispositivo',
}

export const TENENCIA_FILTER_LABELS: Record<Tenencia, string> = {
  propia: 'Propias',
  fletero: 'Fleteros',
}

const STATE_VALUES = Object.keys(STATE_FILTER_LABELS) as FleetStateFilter[]
const TENENCIA_VALUES = Object.keys(TENENCIA_FILTER_LABELS) as Tenencia[]

export interface FleetFilters {
  /** `null` = todas. */
  tenencia: Tenencia | null
  /** `null` = todos. */
  estado: FleetStateFilter | null
  /** `true` = unidades activas (por defecto); `false` = dadas de baja. */
  activa: boolean
}

export const DEFAULT_FLEET_FILTERS: FleetFilters = { tenencia: null, estado: null, activa: true }

/** Valor admitido por la API, o `null` (todas) si no lo es. */
export const parseTenencia = (value: string | null): Tenencia | null =>
  TENENCIA_VALUES.find((v) => v === value) ?? null

export const parseStateFilter = (value: string | null): FleetStateFilter | null =>
  STATE_VALUES.find((v) => v === value) ?? null

/**
 * Lee los filtros de la URL. Un valor ausente o que la API no admite vuelve al valor por
 * defecto, así nunca se envía al servidor un filtro inválido.
 */
export const parseFleetFilters = (params: URLSearchParams): FleetFilters => ({
  tenencia: parseTenencia(params.get('tenencia')),
  estado: parseStateFilter(params.get('estado')),
  activa: params.get('activa') !== 'false',
})

/** Parámetros de URL de los filtros; solo se escriben los que no tienen el valor por defecto. */
export const serializeFleetFilters = (filters: FleetFilters): URLSearchParams => {
  const params = new URLSearchParams()
  if (filters.tenencia) params.set('tenencia', filters.tenencia)
  if (filters.estado) params.set('estado', filters.estado)
  if (!filters.activa) params.set('activa', 'false')
  return params
}

/** Parámetros de GET /unidades. `activa` se envía siempre, de forma explícita. */
export const fleetFiltersToQuery = (filters: FleetFilters) => ({
  tenencia: filters.tenencia ?? undefined,
  estado: filters.estado ?? undefined,
  activa: filters.activa,
})

/** Clave de la consulta de la flota: distinta para cada combinación de filtros. */
export const fleetListQueryKey = (filters: FleetFilters) =>
  ['fleet', 'units', { tenencia: filters.tenencia, estado: filters.estado, activa: filters.activa }] as const

/** ¿Hay un filtro de tenencia o estado aplicado? (la situación activa/baja no cuenta). */
export const hasRefinement = (filters: FleetFilters): boolean =>
  filters.tenencia !== null || filters.estado !== null
