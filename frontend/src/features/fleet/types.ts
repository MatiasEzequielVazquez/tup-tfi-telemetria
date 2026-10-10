import type { DetalleUnidad } from '../../api/types'

// Piezas del detalle de unidad que la feature maneja por separado.
export type Plan = DetalleUnidad['planes'][number]
export type Falla = DetalleUnidad['fallas_activas'][number]
