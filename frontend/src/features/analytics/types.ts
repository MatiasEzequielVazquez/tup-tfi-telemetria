import type { components } from '../../api/schema'
import type { Complete, Tenencia, UnidadResumen } from '../../api/types'

type Schemas = components['schemas']

// Derivados del contrato (docs/openapi.yaml): no se redefinen entidades.
export type Unidad = UnidadResumen
export type Alerta = Complete<Schemas['Alerta']>
export type TipoAlerta = Schemas['TipoAlerta']
export type { Tenencia }

/** Estado de mantenimiento de una unidad; `sin_plan` es `estado_mantenimiento: null`. */
export type EstadoMantenimiento = 'vencida' | 'proxima' | 'postergada' | 'al_dia' | 'sin_plan'
