import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  applyHistoryPatch,
  DEFAULT_HISTORY_FILTERS,
  parseHistoryFilters,
  serializeHistoryFilters,
  type HistoryFilters,
} from '../utils/history'

/**
 * Período y páginas del historial, guardados en los parámetros de la URL: se conservan al
 * recargar o compartir el enlace. Lo inválido se normaliza.
 */
export const useHistoryFilters = () => {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseHistoryFilters(params), [params])
  const canonical = serializeHistoryFilters(filters).toString()

  // Si la URL traía valores no admitidos, se reescribe con los valores normalizados.
  useEffect(() => {
    if (params.toString() !== canonical) setParams(new URLSearchParams(canonical), { replace: true })
  }, [params, canonical, setParams])

  const setFilters = useCallback(
    (patch: Partial<HistoryFilters>) => {
      setParams(serializeHistoryFilters(applyHistoryPatch(filters, patch)), { replace: true })
    },
    [filters, setParams],
  )

  const reset = useCallback(() => {
    setParams(serializeHistoryFilters(DEFAULT_HISTORY_FILTERS), { replace: true })
  }, [setParams])

  return { filters, setFilters, reset }
}
