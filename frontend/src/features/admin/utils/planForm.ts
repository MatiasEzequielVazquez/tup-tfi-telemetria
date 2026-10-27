import type { EstadoPlan } from '../../../api/types'
import type { StatusInfo } from '../../../shared/components/ui/StatusBadge'
import { formatKm } from '../../../shared/utils/formatKm'
import type { CatalogTask, PlanEdit, PlanInput, UnitPlan } from '../types'
import { parsePositiveInteger } from './numbers'

const INTERVAL_ERROR = 'Ingresá un número entero de kilómetros mayor a 0.'

// ---------- asignar una tarea a la unidad ----------

/** Lo que el usuario elige y escribe al asignar una tarea del catálogo a una unidad. */
export interface AssignFormValues {
  /** Código de la tarea; `''` hasta que se elige. */
  codigo: string
  intervalo: string
  umbral: string
  /** Km del último service de esa tarea; vacío = el km actual de la unidad. */
  kmUltimo: string
}

export type AssignFormErrors = Partial<Record<keyof AssignFormValues, string>>

/** Tareas del catálogo que la unidad todavía no tiene (una tarea no se asigna dos veces). */
export const assignableTasks = (catalog: readonly CatalogTask[], plans: readonly UnitPlan[]): CatalogTask[] =>
  catalog.filter((task) => !plans.some((plan) => plan.codigo_tarea === task.codigo))

export const emptyAssignValues = (): AssignFormValues => ({ codigo: '', intervalo: '', umbral: '', kmUltimo: '' })

/** Al elegir una tarea se propone su intervalo y su aviso por defecto (RN03); se pueden ajustar. */
export const withTaskDefaults = (values: AssignFormValues, task: CatalogTask | undefined): AssignFormValues => ({
  ...values,
  codigo: task?.codigo ?? '',
  intervalo: task ? String(task.intervalo_km_default) : '',
  umbral: task ? String(task.umbral_aviso_km_default) : '',
})

/**
 * Validaciones previas al envío, para avisar sin ir al servidor. El servidor sigue siendo
 * quien decide (tarea ya asignada, por ejemplo).
 */
export const validateAssign = (values: AssignFormValues, currentKm: number): AssignFormErrors => {
  const errors: AssignFormErrors = {}

  if (values.codigo === '') errors.codigo = 'Elegí una tarea.'
  if (parsePositiveInteger(values.intervalo) === null) errors.intervalo = INTERVAL_ERROR
  if (parsePositiveInteger(values.umbral) === null) errors.umbral = INTERVAL_ERROR

  const rawKm = values.kmUltimo.trim()
  if (rawKm !== '') {
    const km = Number(rawKm)
    if (!Number.isFinite(km) || km < 0) errors.kmUltimo = 'Ingresá un número mayor o igual a 0.'
    else if (km > currentKm) {
      errors.kmUltimo = `No puede ser mayor al kilometraje actual (${formatKm(currentKm)}).`
    }
  }

  return errors
}

/**
 * Cuerpo de la asignación. El intervalo y el aviso se envían siempre, explícitos. Si no se
 * informa el km del último service, el servidor toma el km actual: la tarea nace al día.
 */
export const buildAssignBody = (values: AssignFormValues): PlanInput => {
  const body: PlanInput = {
    codigo_tarea: values.codigo,
    intervalo_km: parsePositiveInteger(values.intervalo) as number,
    umbral_aviso_km: parsePositiveInteger(values.umbral) as number,
  }
  if (values.kmUltimo.trim() !== '') body.km_ultimo_service = Number(values.kmUltimo.trim())
  return body
}

// ---------- editar el intervalo y el aviso de un plan ----------

export interface EditPlanValues {
  intervalo: string
  umbral: string
}

export type EditPlanErrors = Partial<Record<keyof EditPlanValues, string>>

export const planToValues = (plan: UnitPlan): EditPlanValues => ({
  intervalo: String(plan.intervalo_km),
  umbral: String(plan.umbral_aviso_km),
})

export const validateEditPlan = (values: EditPlanValues): EditPlanErrors => {
  const errors: EditPlanErrors = {}
  if (parsePositiveInteger(values.intervalo) === null) errors.intervalo = INTERVAL_ERROR
  if (parsePositiveInteger(values.umbral) === null) errors.umbral = INTERVAL_ERROR
  return errors
}

/** Solo lo que cambió respecto del plan original. */
export const buildEditPlanBody = (values: EditPlanValues, plan: UnitPlan): PlanEdit => {
  const body: PlanEdit = {}
  const intervalo = parsePositiveInteger(values.intervalo)
  const umbral = parsePositiveInteger(values.umbral)
  if (intervalo !== null && intervalo !== plan.intervalo_km) body.intervalo_km = intervalo
  if (umbral !== null && umbral !== plan.umbral_aviso_km) body.umbral_aviso_km = umbral
  return body
}

export const hasPlanChanges = (body: PlanEdit): boolean => Object.keys(body).length > 0

// ---------- presentación ----------

// Texto + ícono + tono por estado: el significado nunca depende solo del color.
const PLAN_STATUS: Record<EstadoPlan, StatusInfo> = {
  al_dia: { label: 'Al día', icon: '✓', tone: 'ok' },
  proxima: { label: 'Próxima', icon: '▲', tone: 'warn' },
  vencida: { label: 'Vencida', icon: '✕', tone: 'danger' },
  postergada: { label: 'Postergada', icon: '❚❚', tone: 'postponed' },
}

export const planStatusInfo = (estado: EstadoPlan): StatusInfo => PLAN_STATUS[estado]
