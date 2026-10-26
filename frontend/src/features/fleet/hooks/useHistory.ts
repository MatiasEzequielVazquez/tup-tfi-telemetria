import { useQuery } from '@tanstack/react-query'
import { getPostponementHistory, getServiceHistory } from '../services/historyService'
import { historyQueryKey, historyRangeError, type HistoryFilters } from '../utils/history'

/**
 * Los dos listados del historial. La clave incluye el período y la página, así que cada
 * combinación es una consulta distinta y no se muestran datos de otra. Con un período
 * inconsistente (desde posterior a hasta) no se consulta.
 */
export const useServiceHistory = (patente: string, filters: HistoryFilters) =>
  useQuery({
    queryKey: historyQueryKey(patente, 'services', filters),
    queryFn: ({ signal }) => getServiceHistory(patente, filters, signal),
    enabled: historyRangeError(filters) === null,
  })

export const usePostponementHistory = (patente: string, filters: HistoryFilters) =>
  useQuery({
    queryKey: historyQueryKey(patente, 'postergaciones', filters),
    queryFn: ({ signal }) => getPostponementHistory(patente, filters, signal),
    enabled: historyRangeError(filters) === null,
  })
