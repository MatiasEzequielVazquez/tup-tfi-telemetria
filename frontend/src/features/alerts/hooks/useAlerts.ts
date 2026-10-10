import { useQuery } from '@tanstack/react-query'
import { getAlerts, getUnitOptions } from '../services/alertsService'
import { alertListQueryKey, type AlertFilters } from '../utils/filters'

/** La clave incluye estado, tipo, unidad y página: cada combinación es una consulta distinta. */
export const useAlerts = (filters: AlertFilters) =>
  useQuery({
    queryKey: alertListQueryKey(filters),
    queryFn: ({ signal }) => getAlerts(filters, signal),
  })

export const useUnitOptions = () =>
  useQuery({
    queryKey: ['alerts', 'unit-options'],
    queryFn: ({ signal }) => getUnitOptions(signal),
  })
