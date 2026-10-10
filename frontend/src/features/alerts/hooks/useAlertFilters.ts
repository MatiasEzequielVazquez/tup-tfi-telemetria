import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  DEFAULT_ALERT_FILTERS,
  parseAlertFilters,
  serializeAlertFilters,
  type AlertFilters,
} from '../utils/filters'

/**
 * Filtros y página de alertas, guardados en los parámetros de la URL. Lo inválido se
 * normaliza. Cambiar un filtro vuelve a la página 1; cambiar solo la página no toca el resto.
 */
export const useAlertFilters = () => {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseAlertFilters(params), [params])
  const canonical = serializeAlertFilters(filters).toString()

  useEffect(() => {
    if (params.toString() !== canonical) setParams(new URLSearchParams(canonical), { replace: true })
  }, [params, canonical, setParams])

  const setFilters = useCallback(
    (patch: Partial<AlertFilters>) => {
      setParams(serializeAlertFilters({ ...filters, ...patch, page: patch.page ?? 1 }), {
        replace: true,
      })
    },
    [filters, setParams],
  )

  const reset = useCallback(() => {
    setParams(serializeAlertFilters(DEFAULT_ALERT_FILTERS), { replace: true })
  }, [setParams])

  return {
    filters,
    setFilters,
    reset,
    /** Query string normalizado (con `?`), para volver a este listado desde otra pantalla. */
    search: canonical ? `?${canonical}` : '',
  }
}
