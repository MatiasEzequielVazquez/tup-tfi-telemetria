import type { EstadoPlan } from '../../../api/types'
import type { Plan, ServiceInput } from '../types'

/** Largo máximo de las observaciones (el backend admite hasta 2000 caracteres). */
export const MAX_OBSERVATIONS_LENGTH = 2000

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Lo que el usuario escribe y marca en el formulario de registro de service. */
export interface ServiceFormValues {
  /** `YYYY-MM-DD`. */
  fecha: string
  km: string
  observaciones: string
  /** Códigos de las tareas marcadas como realizadas. */
  tareas: string[]
}

export interface ServiceErrors {
  fecha?: string
  km?: string
  observaciones?: string
  tareas?: string
}

// Las que más atención piden, primero.
const URGENCY: Record<EstadoPlan, number> = { vencida: 0, proxima: 1, postergada: 2, al_dia: 3 }

/** Tareas del plan ordenadas de la más urgente a la menos; a igual estado, el orden de la API. */
export const sortPlansByUrgency = (planes: readonly Plan[]): Plan[] =>
  [...planes].sort((a, b) => URGENCY[a.estado] - URGENCY[b.estado])

/** Un service se registra sobre una unidad activa que tiene tareas en su plan. */
export const canRegisterService = (activa: boolean, planes: readonly Plan[]): boolean =>
  activa && planes.length > 0

/** Valores iniciales (CU09): la fecha de hoy y el km actual de la unidad, sin tareas marcadas. */
export const initialServiceValues = (currentKm: number, today: string): ServiceFormValues => ({
  fecha: today,
  km: String(currentKm),
  observaciones: '',
  tareas: [],
})

/** Marca o desmarca una tarea, conservando el orden en que se marcaron. */
export const toggleTask = (selected: readonly string[], code: string): string[] =>
  selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]

/**
 * Validaciones previas al envío (CU09), para avisar sin ir al servidor. El servidor sigue
 * siendo quien decide (por ejemplo, un solo service por unidad y por día).
 */
export const validateService = (values: ServiceFormValues, today: string): ServiceErrors => {
  const errors: ServiceErrors = {}

  const raw = values.km.trim()
  const km = Number(raw)
  if (raw === '') errors.km = 'Ingresá el kilometraje.'
  else if (!Number.isFinite(km) || km < 0) errors.km = 'Ingresá un número mayor o igual a 0.'

  if (!DATE_ONLY.test(values.fecha)) errors.fecha = 'Ingresá la fecha.'
  else if (values.fecha > today) errors.fecha = 'La fecha no puede ser futura.'

  if (values.tareas.length === 0) errors.tareas = 'Seleccioná al menos una tarea.'

  if (values.observaciones.trim().length > MAX_OBSERVATIONS_LENGTH) {
    errors.observaciones = `Admite hasta ${MAX_OBSERVATIONS_LENGTH} caracteres.`
  }

  return errors
}

/**
 * Cuerpo del service. Si la fecha es la de hoy se omite y el servidor usa la suya; las
 * observaciones solo se envían si hay texto.
 */
export const buildServiceBody = (values: ServiceFormValues, today: string): ServiceInput => {
  const body: ServiceInput = { km: Number(values.km.trim()), tareas: [...values.tareas] }
  if (values.fecha !== today) body.fecha = values.fecha
  const observaciones = values.observaciones.trim()
  if (observaciones !== '') body.observaciones = observaciones
  return body
}
