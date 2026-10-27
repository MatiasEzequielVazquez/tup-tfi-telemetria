import { apiGet, apiPost } from '../../../api/client'
import { expectArray, expectRecord, expectString } from '../../../api/guards'
import type { CatalogTask, CatalogTaskInput } from '../types'

const checkTask = (raw: unknown, where: string): CatalogTask => {
  const task = expectRecord(raw, where)
  expectString(task.codigo, `${where} › codigo`)
  return task as unknown as CatalogTask
}

/** GET /tareas-catalogo — el catálogo de tareas con sus intervalos por defecto (RF07, RN03). */
export const getCatalog = async (signal?: AbortSignal): Promise<CatalogTask[]> => {
  const body = expectRecord(await apiGet<unknown>('/tareas-catalogo', { signal }), 'GET /tareas-catalogo')
  return expectArray(body.data, 'GET /tareas-catalogo › data').map((item, index) =>
    checkTask(item, `GET /tareas-catalogo › data[${index}]`),
  )
}

/** POST /tareas-catalogo — alta de un tipo de tarea (RF07). 409 si el código ya existe. */
export const createCatalogTask = async (input: CatalogTaskInput, signal?: AbortSignal): Promise<CatalogTask> =>
  checkTask(await apiPost<unknown>('/tareas-catalogo', { body: input, signal }), 'POST /tareas-catalogo')
