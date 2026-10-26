import type { Dispositivo, MileageInput } from '../types'
import { formatKm } from './format'

/** Lo que el usuario escribe en el formulario de carga de kilometraje. */
export interface MileageFormValues {
  km: string
  /** `YYYY-MM-DD`. */
  fecha: string
}

export interface MileageErrors {
  km?: string
  fecha?: string
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * RF06: la carga manual es para una unidad sin dispositivo o con el dispositivo fuera de
 * servicio. Con uno activo, el kilometraje llega solo por MQTT. Una unidad dada de baja no
 * admite cargas.
 */
export const canLoadMileage = (activa: boolean, dispositivo: Dispositivo): boolean =>
  activa && (dispositivo === null || dispositivo.estado !== 'activo')

/**
 * Validaciones previas al envío, para avisar sin ir al servidor. El servidor sigue siendo
 * quien decide (RN09 incluida): estas solo evitan requests que se sabe que fallan.
 */
export const validateMileage = (
  values: MileageFormValues,
  currentKm: number,
  today: string,
): MileageErrors => {
  const errors: MileageErrors = {}

  const raw = values.km.trim()
  const km = Number(raw)
  if (raw === '') errors.km = 'Ingresá el kilometraje.'
  else if (!Number.isFinite(km) || km < 0) errors.km = 'Ingresá un número mayor o igual a 0.'
  else if (km < currentKm) {
    errors.km = `No puede ser menor al kilometraje actual (${formatKm(currentKm)}).`
  }

  if (!DATE_ONLY.test(values.fecha)) errors.fecha = 'Ingresá la fecha.'
  else if (values.fecha > today) errors.fecha = 'La fecha no puede ser futura.'

  return errors
}

/**
 * Cuerpo de la carga. Si la fecha es la de hoy se omite y el servidor usa el instante actual;
 * una fecha pasada se envía a mediodía de Argentina (UTC-3, sin horario de verano) para que
 * el día no se corra al convertirla a UTC.
 */
export const buildMileageBody = (values: MileageFormValues, today: string): MileageInput => {
  const km = Number(values.km.trim())
  return values.fecha === today ? { km } : { km, fecha: `${values.fecha}T12:00:00-03:00` }
}
