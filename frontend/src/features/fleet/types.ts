import type { paths } from '../../api/schema'
import type { DetalleUnidad } from '../../api/types'

// Piezas del detalle de unidad que la feature maneja por separado.
export type Plan = DetalleUnidad['planes'][number]
export type Falla = DetalleUnidad['fallas_activas'][number]
export type Dispositivo = DetalleUnidad['dispositivo']

/** Cuerpo de POST /unidades/{patente}/kilometraje. */
export type MileageInput =
  paths['/unidades/{patente}/kilometraje']['post']['requestBody']['content']['application/json']
