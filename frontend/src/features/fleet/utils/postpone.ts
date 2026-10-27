import type { EstadoPlan, MotivoPostergacion } from '../../../api/types'
import type { PostponeInput } from '../types'
import { formatKm } from '../../../shared/utils/formatKm'
import { MOTIVO_LABEL } from './statusLabels'

/** Una semana de operación (RN05, CU10): el nuevo límite que se propone sobre el km actual. */
export const SUGGESTED_EXTENSION_KM = 4000

/** Largo máximo de la descripción del motivo (`motivo_descripcion varchar(255)`). */
export const MAX_DESCRIPTION_LENGTH = 255

/** Lo que el usuario escribe en el formulario de postergación. */
export interface PostponeFormValues {
  /** `''` hasta que se elige: el motivo queda registrado, así que no hay uno por defecto. */
  motivo: MotivoPostergacion | ''
  descripcion: string
  limite: string
}

export interface PostponeErrors {
  motivo?: string
  descripcion?: string
  limite?: string
}

const MOTIVOS = Object.keys(MOTIVO_LABEL) as MotivoPostergacion[]

/** Motivo admitido por la API, o `''` (sin elegir) si el valor no lo es. */
export const parseMotivo = (value: string): MotivoPostergacion | '' =>
  MOTIVOS.find((motivo) => motivo === value) ?? ''

/**
 * CU10: se posterga una tarea próxima o vencida de una unidad activa. Una ya postergada vuelve
 * a ser vencida si supera su nuevo límite, y entonces se puede postergar de nuevo.
 */
export const canPostpone = (activa: boolean, estado: EstadoPlan): boolean =>
  activa && (estado === 'proxima' || estado === 'vencida')

/** Nuevo límite propuesto: el km actual más una semana. Entero, porque el contrato lo exige. */
export const suggestedLimit = (currentKm: number): number => Math.ceil(currentKm) + SUGGESTED_EXTENSION_KM

/**
 * Validaciones previas al envío (RN07), para avisar sin ir al servidor. El servidor sigue
 * siendo quien decide: estas solo evitan requests que se sabe que fallan.
 */
export const validatePostpone = (values: PostponeFormValues, currentKm: number): PostponeErrors => {
  const errors: PostponeErrors = {}

  if (values.motivo === '') errors.motivo = 'Elegí un motivo.'
  else if (values.motivo === 'otro') {
    const description = values.descripcion.trim()
    if (description === '') errors.descripcion = 'Describí el motivo.'
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.descripcion = `Admite hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`
    }
  }

  const raw = values.limite.trim()
  const limit = Number(raw)
  if (raw === '') errors.limite = 'Ingresá el nuevo límite.'
  else if (!Number.isInteger(limit)) errors.limite = 'Ingresá un número entero de kilómetros.'
  else if (limit <= currentKm) {
    errors.limite = `Tiene que ser mayor al kilometraje actual (${formatKm(currentKm)}).`
  }

  return errors
}

/** Cuerpo de la postergación. La descripción solo se envía con el motivo "otro". */
export const buildPostponeBody = (values: PostponeFormValues): PostponeInput => {
  const body: PostponeInput = {
    motivo: values.motivo as MotivoPostergacion,
    km_limite_nuevo: Number(values.limite.trim()),
  }
  if (values.motivo === 'otro') body.motivo_descripcion = values.descripcion.trim()
  return body
}
