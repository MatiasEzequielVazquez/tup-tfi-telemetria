import type { CatalogTaskInput } from '../types'
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

/**
 * Validaciones previas al envío, para avisar sin ir al servidor. El servidor sigue siendo
 * quien decide (código repetido, por ejemplo).
 */
export const validateCatalogTask = (values: CatalogFormValues): CatalogFormErrors => {
  const errors: CatalogFormErrors = {}

  const codigo = normalizeCodigo(values.codigo)
  if (codigo === '') errors.codigo = 'Ingresá el código.'
  else if (!CODIGO_PATTERN.test(codigo)) {
    errors.codigo = 'Código inválido: de 2 a 20 caracteres entre mayúsculas, números y guion bajo.'
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
