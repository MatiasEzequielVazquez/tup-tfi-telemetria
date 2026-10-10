import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  DEFAULT_FLEET_FILTERS,
  parseFleetFilters,
  serializeFleetFilters,
  type FleetFilters,
} from '../utils/filters'

/**
 * Filtros de la flota, guardados en los parámetros de la URL: se conservan al recargar o
 * compartir el enlace. Lo que la URL traiga inválido se normaliza.
 */
export const useFleetFilters = () => {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFleetFilters(params), [params])
  const canonical = serializeFleetFilters(filters).toString()

  // Si la URL traía valores no admitidos, se reescribe con los valores normalizados.
  useEffect(() => {
    if (params.toString() !== canonical) setParams(new URLSearchParams(canonical), { replace: true })
  }, [params, canonical, setParams])

  const setFilters = useCallback(
    (patch: Partial<FleetFilters>) => {
      setParams(serializeFleetFilters({ ...filters, ...patch }), { replace: true })
    },
    [filters, setParams],
  )

  const reset = useCallback(() => {
    setParams(serializeFleetFilters(DEFAULT_FLEET_FILTERS), { replace: true })
  }, [setParams])

  return {
    filters,
    setFilters,
    reset,
    /** Query string normalizado (con `?`), para volver a este listado desde el detalle. */
    search: canonical ? `?${canonical}` : '',
  }
}
