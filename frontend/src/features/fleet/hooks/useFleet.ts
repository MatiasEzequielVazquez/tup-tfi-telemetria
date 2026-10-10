import { useQuery } from '@tanstack/react-query'
import { getFleet } from '../services/fleetService'
import { fleetListQueryKey, type FleetFilters } from '../utils/filters'

/**
 * La clave incluye todos los filtros: cada combinación es una consulta distinta, y al
 * cambiar de filtro no se muestran los datos del anterior (no hay datos de relleno).
 */
export const useFleet = (filters: FleetFilters) =>
  useQuery({
    queryKey: fleetListQueryKey(filters),
    queryFn: ({ signal }) => getFleet(filters, signal),
  })
