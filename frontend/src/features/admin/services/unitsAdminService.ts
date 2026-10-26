import { apiDelete, apiPatch, apiPost } from '../../../api/client'
import { expectRecord, expectString } from '../../../api/guards'
import { getAllPages } from '../../../api/pagination'
import type { AdminUnit, Unit, UnitEdit, UnitInput } from '../types'

/**
 * GET /unidades — las unidades activas o las dadas de baja, completas (RF02). Es un acceso
 * propio de la administración: no importa nada de la feature fleet.
 */
export const getAdminUnits = async (activa: boolean, signal?: AbortSignal): Promise<AdminUnit[]> => {
  const { items } = await getAllPages<AdminUnit>('/unidades', {
    label: `GET /unidades?activa=${activa}`,
    query: { activa },
    signal,
    checkItem: (unit, where) => expectString(unit.patente, `${where}.patente`),
  })
  return items
}

const checkUnit = (raw: unknown, where: string): Unit => {
  const unit = expectRecord(raw, where)
  expectString(unit.patente, `${where} › patente`)
  return unit as unknown as Unit
}

/** POST /unidades — alta (RF02). Nace con km 0, fuente manual y sin planes ni dispositivo. */
export const createUnit = async (input: UnitInput, signal?: AbortSignal): Promise<Unit> =>
  checkUnit(await apiPost<unknown>('/unidades', { body: input, signal }), 'POST /unidades')

/** PATCH /unidades/{patente} — modificación de datos (RF02). */
export const updateUnit = async (patente: string, input: UnitEdit, signal?: AbortSignal): Promise<Unit> =>
  checkUnit(
    await apiPatch<unknown>('/unidades/{patente}', { pathParams: { patente }, body: input, signal }),
    'PATCH /unidades/{patente}',
  )

/** DELETE /unidades/{patente} — baja lógica (RF02): conserva el historial. 409 si tiene dispositivo. */
export const deactivateUnit = async (patente: string, signal?: AbortSignal): Promise<Unit> =>
  checkUnit(
    await apiDelete<unknown>('/unidades/{patente}', { pathParams: { patente }, signal }),
    'DELETE /unidades/{patente}',
  )
