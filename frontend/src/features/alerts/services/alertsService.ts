import { apiPatch } from '../../../api/client'
import { expectRecord, expectString } from '../../../api/guards'
import { getAllPages, getPage, type PageResult } from '../../../api/pagination'
import type { Alerta, UnitOption } from '../types'
import {
  ALERTS_PAGE_SIZE,
  alertFiltersToQuery,
  type AlertFilters,
} from '../utils/filters'
import { buildReviewBody } from '../utils/identity'

const checkAlert = (alerta: Record<string, unknown>, where: string): void => {
  expectString(alerta.origen, `${where}.origen`)
  expectString(alerta.tipo, `${where}.tipo`)
  expectString(alerta.estado, `${where}.estado`)
  expectRecord(alerta.clave, `${where}.clave`)
}

/**
 * GET /alertas — una página de alertas con los filtros. Las más antiguas primero, como las
 * entrega la API. `total` es el de todo el resultado filtrado, no el de la página.
 */
export const getAlerts = (filters: AlertFilters, signal?: AbortSignal): Promise<PageResult<Alerta>> =>
  getPage<Alerta>('/alertas', {
    label: 'GET /alertas',
    query: alertFiltersToQuery(filters),
    page: filters.page,
    pageSize: ALERTS_PAGE_SIZE,
    signal,
    checkItem: checkAlert,
  })

/** PATCH /alertas/revisar — devuelve la alerta ya revisada, tal como la confirmó el servidor. */
export const reviewAlert = async (alerta: Alerta, signal?: AbortSignal): Promise<Alerta> => {
  const body = buildReviewBody(alerta)
  const raw = await apiPatch<unknown>('/alertas/revisar', { body, signal })
  const confirmed = expectRecord(raw, 'PATCH /alertas/revisar')
  checkAlert(confirmed, 'PATCH /alertas/revisar')
  return confirmed as unknown as Alerta
}

/**
 * Unidades para el selector de unidad, incluidas las dadas de baja (pueden tener alertas).
 *
 * Es un acceso mínimo a GET /unidades que alerts hace por su cuenta: no importa nada de la
 * feature fleet. Solo toma la patente y si está activa; la paginación es la del módulo
 * compartido api/pagination.
 */
export const getUnitOptions = async (signal?: AbortSignal): Promise<UnitOption[]> => {
  const fetchUnits = (activa: boolean) =>
    getAllPages<UnitOption>('/unidades', {
      label: `GET /unidades?activa=${activa}`,
      query: { activa },
      signal,
      checkItem: (unidad, where) => expectString(unidad.patente, `${where}.patente`),
    })

  const [activas, bajas] = await Promise.all([fetchUnits(true), fetchUnits(false)])
  return [...activas.items, ...bajas.items]
    .map(({ patente, activa }) => ({ patente, activa }))
    .sort((a, b) => a.patente.localeCompare(b.patente))
}
