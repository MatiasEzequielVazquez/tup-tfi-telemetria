import { apiGet, apiPatch, apiPost } from '../../../api/client'
import { expectArray, expectNumber, expectRecord, expectString } from '../../../api/guards'
import type { PlanEdit, PlanInput, Unit, UnitPlan } from '../types'

const checkPlan = (raw: unknown, where: string): UnitPlan => {
  const plan = expectRecord(raw, where)
  expectString(plan.codigo_tarea, `${where} › codigo_tarea`)
  expectNumber(plan.intervalo_km, `${where} › intervalo_km`)
  return plan as unknown as UnitPlan
}

/** GET /unidades/{patente} — datos básicos de la unidad (el km actual acota el último service). */
export const getUnit = async (patente: string, signal?: AbortSignal): Promise<Unit> => {
  const unit = expectRecord(
    await apiGet<unknown>('/unidades/{patente}', { pathParams: { patente }, signal }),
    'GET /unidades/{patente}',
  )
  expectString(unit.patente, 'GET /unidades/{patente} › patente')
  expectNumber(unit.km_actual, 'GET /unidades/{patente} › km_actual')
  return unit as unknown as Unit
}

/** GET /unidades/{patente}/planes — las tareas de la unidad con su estado actual (RF07, RF08). */
export const getUnitPlans = async (patente: string, signal?: AbortSignal): Promise<UnitPlan[]> => {
  const where = 'GET /unidades/{patente}/planes'
  const body = expectRecord(await apiGet<unknown>('/unidades/{patente}/planes', { pathParams: { patente }, signal }), where)
  return expectArray(body.data, `${where} › data`).map((item, index) => checkPlan(item, `${where} › data[${index}]`))
}

/** POST /unidades/{patente}/planes — asigna una tarea del catálogo a la unidad (RF07). 409 si ya la tiene. */
export const assignTask = async (patente: string, input: PlanInput, signal?: AbortSignal): Promise<UnitPlan> =>
  checkPlan(
    await apiPost<unknown>('/unidades/{patente}/planes', { pathParams: { patente }, body: input, signal }),
    'POST /unidades/{patente}/planes',
  )

/** PATCH /unidades/{patente}/planes/{codigo_tarea} — cambia el intervalo o el aviso; recalcula el estado. */
export const updatePlan = async (
  patente: string,
  codigoTarea: string,
  input: PlanEdit,
  signal?: AbortSignal,
): Promise<UnitPlan> =>
  checkPlan(
    await apiPatch<unknown>('/unidades/{patente}/planes/{codigo_tarea}', {
      pathParams: { patente, codigo_tarea: codigoTarea },
      body: input,
      signal,
    }),
    'PATCH /unidades/{patente}/planes/{codigo_tarea}',
  )
