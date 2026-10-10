import type { components } from '../../api/schema'
import type { Complete } from '../../api/types'

type Schemas = components['schemas']

// Derivados del contrato (docs/openapi.yaml): no se redefinen entidades.
export type Alerta = Complete<Schemas['Alerta']>
export type TipoAlerta = Schemas['TipoAlerta']
export type OrigenAlerta = Alerta['origen']
export type EstadoAlerta = Alerta['estado']

/** Cuerpo de PATCH /alertas/revisar: `{ origen, ...clave }`, según el origen. */
export type RevisarAlertaBody =
  | Schemas['RevisarPlan']
  | Schemas['RevisarFalla']
  | Schemas['RevisarDispositivo']

/** Opción del selector de unidad. */
export interface UnitOption {
  patente: string
  activa: boolean
}
