import { useQuery } from '@tanstack/react-query'
import { getAllAlerts, getFleetUnits } from '../services/analyticsService'

/** Cada cuánto se vuelven a pedir los datos con la pantalla abierta (la flota reporta sola). */
export const REFRESH_MS = 30_000

export const useFleetAnalytics = () => {
  const units = useQuery({
    queryKey: ['analytics', 'units'],
    queryFn: ({ signal }) => getFleetUnits(signal),
    refetchInterval: REFRESH_MS,
  })
  const alerts = useQuery({
    queryKey: ['analytics', 'alerts'],
    queryFn: ({ signal }) => getAllAlerts(signal),
    refetchInterval: REFRESH_MS,
  })

  return {
    units,
    alerts,
    isPending: units.isPending || alerts.isPending,
    error: units.error ?? alerts.error,
    isFetching: units.isFetching || alerts.isFetching,
    updatedAt: Math.min(units.dataUpdatedAt, alerts.dataUpdatedAt),
    refetch: () => Promise.all([units.refetch(), alerts.refetch()]),
  }
}
