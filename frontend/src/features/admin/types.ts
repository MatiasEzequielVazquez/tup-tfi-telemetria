import type { components } from '../../api/schema'
import type { Complete, UnidadResumen } from '../../api/types'

type Schemas = components['schemas']

/** Una unidad del listado de administración (la misma forma que la vista de flota). */
export type AdminUnit = UnidadResumen

/** Respuesta de alta, edición y baja de una unidad. */
export type Unit = Complete<Schemas['Unidad']>

/** Un dispositivo con su vinculación vigente (`vinculacion_actual`, o `null` si no está vinculado). */
export type Device = Complete<Schemas['Dispositivo']>

/** Cuerpo de POST /unidades. */
export type UnitInput = Schemas['UnidadInput']

/** Cuerpo de PATCH /unidades/{patente}: solo los campos que cambian. */
export type UnitEdit = Schemas['UnidadEdicion']
