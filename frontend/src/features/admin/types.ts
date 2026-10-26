import type { components, paths } from '../../api/schema'
import type { Complete, UnidadResumen } from '../../api/types'

type Schemas = components['schemas']

/** Una unidad del listado de administración (la misma forma que la vista de flota). */
export type AdminUnit = UnidadResumen

/** Respuesta de alta, edición y baja de una unidad. */
export type Unit = Complete<Schemas['Unidad']>

/** Un dispositivo con su vinculación vigente (`vinculacion_actual`, o `null` si no está vinculado). */
export type Device = Complete<Schemas['Dispositivo']>

/** Una tarea del catálogo, con sus intervalos por defecto (RN03). */
export type CatalogTask = Complete<Schemas['TareaCatalogo']>

/** Una tarea del plan de una unidad, con su estado y los km que calcula la API. */
export type UnitPlan = Complete<Schemas['Plan']>

/** Cuerpo de POST /unidades/{patente}/planes. */
export type PlanInput = Schemas['PlanInput']

/** Cuerpo de PATCH /unidades/{patente}/planes/{codigo_tarea}: solo lo que cambia. */
export type PlanEdit = NonNullable<
  paths['/unidades/{patente}/planes/{codigo_tarea}']['patch']['requestBody']
>['content']['application/json']

/** Cuerpo de POST /tareas-catalogo. */
export type CatalogTaskInput = Schemas['TareaCatalogo']

/** Cuerpo de POST /unidades. */
export type UnitInput = Schemas['UnidadInput']

/** Cuerpo de PATCH /unidades/{patente}: solo los campos que cambian. */
export type UnitEdit = Schemas['UnidadEdicion']
