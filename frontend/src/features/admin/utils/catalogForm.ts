import type { CatalogTask, CatalogTaskEdit, CatalogTaskInput } from '../types'
import { parsePositiveInteger } from './numbers'

/** Código de una tarea: mayúsculas, números y guion bajo, de 2 a 20 caracteres. */
export const CODIGO_PATTERN = /^[A-Z0-9_]{2,20}$/
export const MAX_NOMBRE = 100

/** Umbral de aviso por defecto: 4.000 km, una semana de operación (RN05). */
export const DEFAULT_WARNING_KM = 4000

/** Lo que el usuario escribe en el formulario de una tarea del catálogo. */
export interface CatalogFormValues {
  codigo: string
  nombre: string
  intervalo: string
  umbral: string
}

export type CatalogFormErrors = Partial<Record<keyof CatalogFormValues, string>>

/** El código se guarda en mayúsculas y con guion bajo en lugar de espacios. */
export const normalizeCodigo = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, '_')

export const emptyCatalogValues = (): CatalogFormValues => ({
  codigo: '',
  nombre: '',
  intervalo: '',
  umbral: String(DEFAULT_WARNING_KM),
})

export const catalogTaskToValues = (task: CatalogTask): CatalogFormValues => ({
  codigo: task.codigo,
  nombre: task.nombre,
  intervalo: String(task.intervalo_km_default),
  umbral: String(task.umbral_aviso_km_default),
})

/**
 * Validaciones previas al envío, para avisar sin ir al servidor. El servidor sigue siendo
 * quien decide (código repetido, por ejemplo). Al editar no se valida el código: no se cambia.
 */
export const validateCatalogTask = (
  values: CatalogFormValues,
  { editing }: { editing: boolean } = { editing: false },
): CatalogFormErrors => {
  const errors: CatalogFormErrors = {}

  if (!editing) {
    const codigo = normalizeCodigo(values.codigo)
    if (codigo === '') errors.codigo = 'Ingresá el código.'
    else if (!CODIGO_PATTERN.test(codigo)) {
      errors.codigo = 'Código inválido: de 2 a 20 caracteres entre mayúsculas, números y guion bajo.'
    }
  }

  const nombre = values.nombre.trim()
  if (nombre === '') errors.nombre = 'Ingresá el nombre.'
  else if (nombre.length > MAX_NOMBRE) errors.nombre = `Admite hasta ${MAX_NOMBRE} caracteres.`

  if (parsePositiveInteger(values.intervalo) === null) {
    errors.intervalo = 'Ingresá un número entero de kilómetros mayor a 0.'
  }
  if (parsePositiveInteger(values.umbral) === null) {
    errors.umbral = 'Ingresá un número entero de kilómetros mayor a 0.'
  }

  return errors
}

/** Cuerpo del alta de una tarea del catálogo. Solo se llama con valores ya validados. */
export const buildCatalogBody = (values: CatalogFormValues): CatalogTaskInput => ({
  codigo: normalizeCodigo(values.codigo),
  nombre: values.nombre.trim(),
  intervalo_km_default: parsePositiveInteger(values.intervalo) as number,
  umbral_aviso_km_default: parsePositiveInteger(values.umbral) as number,
})

/** Cuerpo de la edición: solo lo que cambió. Solo se llama con valores ya validados. */
export const buildEditCatalogBody = (values: CatalogFormValues, original: CatalogTask): CatalogTaskEdit => {
  const body: CatalogTaskEdit = {}
  const nombre = values.nombre.trim()
  const intervalo = parsePositiveInteger(values.intervalo) as number
  const umbral = parsePositiveInteger(values.umbral) as number
  if (nombre !== original.nombre) body.nombre = nombre
  if (intervalo !== original.intervalo_km_default) body.intervalo_km_default = intervalo
  if (umbral !== original.umbral_aviso_km_default) body.umbral_aviso_km_default = umbral
  return body
}

export const hasCatalogChanges = (body: CatalogTaskEdit): boolean => Object.keys(body).length > 0
