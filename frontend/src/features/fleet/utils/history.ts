import { isDateOnly } from '../../../shared/utils/formatDate'

/** Cantidad de elementos por página, en cada uno de los dos listados (el contrato admite hasta 100). */
export const HISTORY_PAGE_SIZE = 10

export interface HistoryFilters {
  /** Fecha inicial inclusiva (`YYYY-MM-DD`); `null` = sin límite. */
  desde: string | null
  /** Fecha final inclusiva (`YYYY-MM-DD`); `null` = sin límite. */
  hasta: string | null
  /** Página del listado de services, desde 1. */
  servicesPage: number
  /** Página del listado de postergaciones, desde 1. */
  postponementsPage: number
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  desde: null,
  hasta: null,
  servicesPage: 1,
  postponementsPage: 1,
}

const parseDate = (value: string | null): string | null =>
  value !== null && isDateOnly(value) ? value : null

const parsePage = (value: string | null): number => {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Lee los filtros de la URL; lo inválido o ausente vuelve al valor por defecto. */
export const parseHistoryFilters = (params: URLSearchParams): HistoryFilters => ({
  desde: parseDate(params.get('desde')),
  hasta: parseDate(params.get('hasta')),
  servicesPage: parsePage(params.get('services_page')),
  postponementsPage: parsePage(params.get('postergaciones_page')),
})

/** Parámetros de URL; solo se escriben los que no tienen el valor por defecto. */
export const serializeHistoryFilters = (filters: HistoryFilters): URLSearchParams => {
  const params = new URLSearchParams()
  if (filters.desde) params.set('desde', filters.desde)
  if (filters.hasta) params.set('hasta', filters.hasta)
  if (filters.servicesPage > 1) params.set('services_page', String(filters.servicesPage))
  if (filters.postponementsPage > 1) params.set('postergaciones_page', String(filters.postponementsPage))
  return params
}

/**
 * Aplica un cambio a los filtros. Cambiar el período vuelve las dos listas a la página 1;
 * cambiar la página de una no toca la otra.
 */
export const applyHistoryPatch = (current: HistoryFilters, patch: Partial<HistoryFilters>): HistoryFilters => {
  const periodChanged = 'desde' in patch || 'hasta' in patch
  return {
    ...current,
    ...patch,
    servicesPage: patch.servicesPage ?? (periodChanged ? 1 : current.servicesPage),
    postponementsPage: patch.postponementsPage ?? (periodChanged ? 1 : current.postponementsPage),
  }
}

/** Mensaje si el período es inconsistente; en ese caso no se consulta. */
export const historyRangeError = (filters: HistoryFilters): string | null =>
  filters.desde && filters.hasta && filters.desde > filters.hasta
    ? 'La fecha "Desde" no puede ser posterior a "Hasta".'
    : null

/** Parámetros de filtro de los listados (la paginación la agrega el servicio). */
export const historyFiltersToQuery = (filters: HistoryFilters) => ({
  desde: filters.desde ?? undefined,
  hasta: filters.hasta ?? undefined,
})

export type HistoryKind = 'services' | 'postergaciones'

/**
 * Clave de la consulta de un listado: cuelga de la unidad (`['fleet', 'unit', patente]`) para
 * que se vuelva a pedir cuando se registra un service o una postergación.
 */
export const historyQueryKey = (patente: string, kind: HistoryKind, filters: HistoryFilters) =>
  [
    'fleet',
    'unit',
    patente,
    'history',
    kind,
    {
      desde: filters.desde,
      hasta: filters.hasta,
      page: kind === 'services' ? filters.servicesPage : filters.postponementsPage,
    },
  ] as const

/** Cantidad de páginas para un total (mínimo 1). */
export const pageCount = (total: number): number => Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
