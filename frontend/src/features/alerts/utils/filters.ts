import type { TipoAlerta } from '../types'
import { ALERT_TYPE_INFO } from './labels'

/** Cantidad de alertas por página (el contrato admite de 1 a 100; por defecto 20). */
export const ALERTS_PAGE_SIZE = 20

/** `todas` no es un valor de la API: significa "no filtrar por estado". */
export type AlertStatusFilter = 'abierta' | 'revisada' | 'todas'

export const STATUS_FILTER_LABELS: Record<AlertStatusFilter, string> = {
  abierta: 'Abiertas',
  revisada: 'Revisadas',
  todas: 'Todas',
}

const STATUS_VALUES = Object.keys(STATUS_FILTER_LABELS) as AlertStatusFilter[]
const TYPE_VALUES = Object.keys(ALERT_TYPE_INFO) as TipoAlerta[]

// Formato de patente que acepta la API para consultar (mayúsculas y números).
const PATENTE_PATTERN = /^[A-Z0-9]{6,10}$/

export interface AlertFilters {
  estado: AlertStatusFilter
  /** `null` = todos los tipos. */
  tipo: TipoAlerta | null
  /** `null` = todas las unidades. */
  patente: string | null
  /** Página, desde 1. */
  page: number
}

export const DEFAULT_ALERT_FILTERS: AlertFilters = {
  estado: 'abierta',
  tipo: null,
  patente: null,
  page: 1,
}

export const parseAlertStatus = (value: string | null): AlertStatusFilter =>
  STATUS_VALUES.find((v) => v === value) ?? DEFAULT_ALERT_FILTERS.estado

export const parseAlertType = (value: string | null): TipoAlerta | null =>
  TYPE_VALUES.find((v) => v === value) ?? null

export const parsePatente = (value: string | null): string | null => {
  const normalized = (value ?? '').trim().toUpperCase()
  return PATENTE_PATTERN.test(normalized) ? normalized : null
}

const parsePage = (value: string | null): number => {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Lee los filtros de la URL; lo inválido o ausente vuelve al valor por defecto. */
export const parseAlertFilters = (params: URLSearchParams): AlertFilters => ({
  estado: parseAlertStatus(params.get('estado')),
  tipo: parseAlertType(params.get('tipo')),
  patente: parsePatente(params.get('patente')),
  page: parsePage(params.get('page')),
})

/** Parámetros de URL; solo se escriben los que no tienen el valor por defecto. */
export const serializeAlertFilters = (filters: AlertFilters): URLSearchParams => {
  const params = new URLSearchParams()
  if (filters.estado !== DEFAULT_ALERT_FILTERS.estado) params.set('estado', filters.estado)
  if (filters.tipo) params.set('tipo', filters.tipo)
  if (filters.patente) params.set('patente', filters.patente)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

/** Parámetros de filtro de GET /alertas (la paginación la agrega el servicio). */
export const alertFiltersToQuery = (filters: AlertFilters) => ({
  estado: filters.estado === 'todas' ? undefined : filters.estado,
  tipo: filters.tipo ?? undefined,
  patente: filters.patente ?? undefined,
})

export const ALERTS_QUERY_KEY = ['alerts'] as const
export const ALERTS_LIST_QUERY_KEY = ['alerts', 'list'] as const

/** Clave de la consulta de alertas: distinta para cada combinación de filtros y página. */
export const alertListQueryKey = (filters: AlertFilters) =>
  [
    ...ALERTS_LIST_QUERY_KEY,
    { estado: filters.estado, tipo: filters.tipo, patente: filters.patente, page: filters.page },
  ] as const

/** Cantidad de páginas para un total (mínimo 1). */
export const pageCount = (total: number): number =>
  Math.max(1, Math.ceil(total / ALERTS_PAGE_SIZE))
