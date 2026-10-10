import { useQuery } from '@tanstack/react-query'
import { getUnitDetail } from '../services/fleetService'

export const useUnitDetail = (patente: string) =>
  useQuery({
    queryKey: ['fleet', 'unit', patente, 'detail'],
    queryFn: ({ signal }) => getUnitDetail(patente, signal),
  })
