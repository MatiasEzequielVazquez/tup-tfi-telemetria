import { apiGet, apiPatch, apiPost } from '../../../api/client'
import { expectArray, expectBoolean, expectRecord, expectString } from '../../../api/guards'
import type { CatalogTask, CatalogTaskEdit, CatalogTaskInput } from '../types'

const checkTask = (raw: unknown, where: string): CatalogTask => {
  const task = expectRecord(raw, where)
  expectString(task.codigo, `${where} › codigo`)
  expectBoolean(task.activa, `${where} › activa`)
  return task as unknown as CatalogTask
}

/**
 * GET /tareas-catalogo — el catálogo de tareas con sus intervalos por defecto (RF07, RN03).
 * Sin filtro trae todas, con las dadas de baja al final (para poder reactivarlas); con
 * `activa: true`, solo las que se pueden asignar a una unidad.
 */
export const getCatalog = async (filter: { activa?: boolean } = {}, signal?: AbortSignal): Promise<CatalogTask[]> => {
  const body = expectRecord(
    await apiGet<unknown>('/tareas-catalogo', { query: { activa: filter.activa }, signal }),
    'GET /tareas-catalogo',
  )
  return expectArray(body.data, 'GET /tareas-catalogo › data').map((item, index) =>
    checkTask(item, `GET /tareas-catalogo › data[${index}]`),
  )
}

/** POST /tareas-catalogo — alta de un tipo de tarea (RF07). 409 si el código ya existe. */
export const createCatalogTask = async (input: CatalogTaskInput, signal?: AbortSignal): Promise<CatalogTask> =>
  checkTask(await apiPost<unknown>('/tareas-catalogo', { body: input, signal }), 'POST /tareas-catalogo')

/**
 * PATCH /tareas-catalogo/{codigo} — edita el nombre y los valores por defecto, o da de baja o
 * reactiva la tarea (`activa`). Los planes existentes no cambian. El código no se edita.
 */
export const updateCatalogTask = async (
  codigo: string,
  input: CatalogTaskEdit,
  signal?: AbortSignal,
): Promise<CatalogTask> =>
  checkTask(
    await apiPatch<unknown>('/tareas-catalogo/{codigo}', { pathParams: { codigo }, body: input, signal }),
    'PATCH /tareas-catalogo/{codigo}',
  )
