import { expectArray, expectNumber, expectString } from '../../../api/guards'
import { getPage, type PageResult } from '../../../api/pagination'
import type { Postergacion, Service } from '../../../api/types'
import { HISTORY_PAGE_SIZE, historyFiltersToQuery, type HistoryFilters } from '../utils/history'

/**
 * GET /unidades/{patente}/services — una página del historial de services (RF16), del más
 * reciente al más antiguo, dentro del período. `total` es el de todo el resultado filtrado.
 */
export const getServiceHistory = (
  patente: string,
  filters: HistoryFilters,
  signal?: AbortSignal,
): Promise<PageResult<Service>> =>
  getPage<Service>('/unidades/{patente}/services', {
    label: 'GET /unidades/{patente}/services',
    pathParams: { patente },
    query: historyFiltersToQuery(filters),
    page: filters.servicesPage,
    pageSize: HISTORY_PAGE_SIZE,
    signal,
    checkItem: (service, where) => {
      expectString(service.fecha, `${where}.fecha`)
      expectArray(service.tareas, `${where}.tareas`)
    },
  })

/**
 * GET /unidades/{patente}/postergaciones — una página del historial de postergaciones (RF16),
 * de la más reciente a la más antigua, dentro del período.
 */
export const getPostponementHistory = (
  patente: string,
  filters: HistoryFilters,
  signal?: AbortSignal,
): Promise<PageResult<Postergacion>> =>
  getPage<Postergacion>('/unidades/{patente}/postergaciones', {
    label: 'GET /unidades/{patente}/postergaciones',
    pathParams: { patente },
    query: historyFiltersToQuery(filters),
    page: filters.postponementsPage,
    pageSize: HISTORY_PAGE_SIZE,
    signal,
    checkItem: (postergacion, where) => {
      expectString(postergacion.codigo_tarea, `${where}.codigo_tarea`)
      expectNumber(postergacion.km_limite_nuevo, `${where}.km_limite_nuevo`)
    },
  })
