import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Situación del listado de unidades (activas o dadas de baja), guardada en la URL como
 * `activa=false`. Lo que la URL traiga inválido se normaliza a "activas".
 */
export const useAdminUnitsFilter = () => {
  const [params, setParams] = useSearchParams()
  const activa = params.get('activa') !== 'false'
  const canonical = activa ? '' : 'activa=false'

  useEffect(() => {
    if (params.toString() !== canonical) setParams(new URLSearchParams(canonical), { replace: true })
  }, [params, canonical, setParams])

  const setActiva = useCallback(
    (value: boolean) => setParams(new URLSearchParams(value ? '' : 'activa=false'), { replace: true }),
    [setParams],
  )

  return { activa, setActiva }
}
