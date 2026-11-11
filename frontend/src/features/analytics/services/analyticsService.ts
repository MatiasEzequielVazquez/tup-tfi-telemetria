import { expectNumber, expectString } from '../../../api/guards'
import { getAllPages } from '../../../api/pagination'
import type { Alerta, Unidad } from '../types'

// Las analíticas se calculan en el navegador con lo que ya expone la API: no hay endpoints
// de agregados. Por eso se traen todas las páginas de cada listado.

/** GET /unidades — la flota activa completa (las unidades dadas de baja no cuentan). */
export const getFleetUnits = async (signal?: AbortSignal): Promise<Unidad[]> => {
  const { items } = await getAllPages<Unidad>('/unidades', {
    label: 'GET /unidades',
    query: { activa: true },
    signal,
    checkItem: (unidad, where) => {
      expectString(unidad.patente, `${where}.patente`)
      expectNumber(unidad.km_actual, `${where}.km_actual`)
    },
  })
  return items
}

/** GET /alertas — todas, abiertas y revisadas, de todos los orígenes. */
export const getAllAlerts = async (signal?: AbortSignal): Promise<Alerta[]> => {
  const { items } = await getAllPages<Alerta>('/alertas', {
    label: 'GET /alertas',
    signal,
    checkItem: (alerta, where) => {
      expectString(alerta.origen, `${where}.origen`)
      expectString(alerta.tipo, `${where}.tipo`)
      expectString(alerta.estado, `${where}.estado`)
      expectString(alerta.fecha_generada, `${where}.fecha_generada`)
    },
  })
  return items
}
