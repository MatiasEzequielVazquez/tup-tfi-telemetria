import type { Protocolo, Tenencia } from '../../../api/types'
import type { AdminUnit, UnitEdit, UnitInput } from '../types'
import { PROTOCOLO_LABEL, TENENCIA_LABEL } from './labels'

export const PATENTE_PATTERN = /^[A-Z0-9]{6,10}$/
export const MIN_YEAR = 1950
export const MAX_MARCA = 50
export const MAX_MODELO = 50
export const MAX_TITULAR = 100

/** Lo que el usuario escribe en el formulario de una unidad. */
export interface UnitFormValues {
  patente: string
  marca: string
  modelo: string
  anio: string
  /** `''` hasta que se elige: es un dato que no conviene dejar por defecto. */
  tenencia: Tenencia | ''
  titular: string
  protocolo: Protocolo | ''
}

export type UnitFormErrors = Partial<Record<keyof UnitFormValues, string>>

const TENENCIAS = Object.keys(TENENCIA_LABEL) as Tenencia[]
const PROTOCOLOS = Object.keys(PROTOCOLO_LABEL) as Protocolo[]

/** Valor admitido por la API, o `''` (sin elegir) si no lo es. */
export const parseTenencia = (value: string): Tenencia | '' => TENENCIAS.find((t) => t === value) ?? ''
export const parseProtocolo = (value: string): Protocolo | '' => PROTOCOLOS.find((p) => p === value) ?? ''

/** La patente se guarda en mayúsculas y sin espacios, como la normaliza el servidor. */
export const normalizePatente = (value: string): string => value.toUpperCase().replace(/\s+/g, '')

export const emptyUnitValues = (): UnitFormValues => ({
  patente: '',
  marca: '',
  modelo: '',
  anio: '',
  tenencia: '',
  titular: '',
  protocolo: '',
})

/** Valores de una unidad existente, para editarla. */
export const unitToValues = (unit: AdminUnit): UnitFormValues => ({
  patente: unit.patente,
  marca: unit.marca,
  modelo: unit.modelo ?? '',
  anio: unit.anio === null ? '' : String(unit.anio),
  tenencia: unit.tenencia,
  titular: unit.titular ?? '',
  protocolo: unit.protocolo,
})

/**
 * Validaciones previas al envío, para avisar sin ir al servidor. El servidor sigue siendo
 * quien decide (patente repetida, por ejemplo). `original` es la unidad que se edita: el año
 * de una unidad que ya lo tiene no se puede dejar vacío, porque el contrato no permite borrarlo.
 */
export const validateUnit = (
  values: UnitFormValues,
  { editing, original, currentYear }: { editing: boolean; original?: AdminUnit; currentYear: number },
): UnitFormErrors => {
  const errors: UnitFormErrors = {}

  if (!editing) {
    const patente = normalizePatente(values.patente)
    if (patente === '') errors.patente = 'Ingresá la patente.'
    else if (!PATENTE_PATTERN.test(patente)) {
      errors.patente = 'Patente inválida: de 6 a 10 letras o números, sin espacios.'
    }
  }

  const marca = values.marca.trim()
  if (marca === '') errors.marca = 'Ingresá la marca.'
  else if (marca.length > MAX_MARCA) errors.marca = `Admite hasta ${MAX_MARCA} caracteres.`

  if (values.modelo.trim().length > MAX_MODELO) errors.modelo = `Admite hasta ${MAX_MODELO} caracteres.`

  const maxYear = currentYear + 1
  const rawYear = values.anio.trim()
  if (rawYear !== '') {
    const year = Number(rawYear)
    if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear) {
      errors.anio = `Ingresá un año entre ${MIN_YEAR} y ${maxYear}.`
    }
  } else if (editing && original?.anio != null) {
    errors.anio = 'El año ya está cargado: se puede corregir, pero no dejar vacío.'
  }

  if (values.tenencia === '') errors.tenencia = 'Elegí la tenencia.'
  if (values.protocolo === '') errors.protocolo = 'Elegí el protocolo.'
  if (values.titular.trim().length > MAX_TITULAR) errors.titular = `Admite hasta ${MAX_TITULAR} caracteres.`

  return errors
}

/** El titular es el dueño de una unidad de un fletero: en una propia no corresponde. */
const effectiveTitular = (values: UnitFormValues): string =>
  values.tenencia === 'fletero' ? values.titular.trim() : ''

/** Cuerpo del alta. Los campos opcionales vacíos no se envían. */
export const buildCreateBody = (values: UnitFormValues): UnitInput => {
  const body: UnitInput = {
    patente: normalizePatente(values.patente),
    marca: values.marca.trim(),
    tenencia: values.tenencia as Tenencia,
    protocolo: values.protocolo as Protocolo,
  }
  const modelo = values.modelo.trim()
  const titular = effectiveTitular(values)
  if (modelo !== '') body.modelo = modelo
  if (values.anio.trim() !== '') body.anio = Number(values.anio.trim())
  if (titular !== '') body.titular = titular
  return body
}

/**
 * Cuerpo de la edición: solo lo que cambió respecto de la unidad original. El modelo y el
 * titular se pueden vaciar enviando un texto vacío.
 */
export const buildEditBody = (values: UnitFormValues, original: AdminUnit): UnitEdit => {
  const body: UnitEdit = {}
  const marca = values.marca.trim()
  const modelo = values.modelo.trim()
  const titular = effectiveTitular(values)

  if (marca !== original.marca) body.marca = marca
  if (modelo !== (original.modelo ?? '')) body.modelo = modelo
  if (values.anio.trim() !== '' && Number(values.anio.trim()) !== original.anio) {
    body.anio = Number(values.anio.trim())
  }
  if (values.tenencia !== original.tenencia) body.tenencia = values.tenencia as Tenencia
  if (titular !== (original.titular ?? '')) body.titular = titular
  if (values.protocolo !== original.protocolo) body.protocolo = values.protocolo as Protocolo
  return body
}

/** ¿Hay algo para guardar? */
export const hasChanges = (body: UnitEdit): boolean => Object.keys(body).length > 0
