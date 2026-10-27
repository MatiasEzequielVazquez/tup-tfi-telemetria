import type { EstadoDispositivo } from '../../../api/types'
import type { StatusInfo } from '../../../shared/components/ui/StatusBadge'
import type { AdminUnit } from '../types'

/** Identificador que envía el firmware: de 3 a 50 caracteres entre letras, números, `_` y `-`. */
export const DEVICE_UID_PATTERN = /^[\w-]{3,50}$/

/** Error de validación del identificador, o `null` si es válido. */
export const validateDeviceUid = (value: string): string | null => {
  const uid = value.trim()
  if (uid === '') return 'Ingresá el identificador del dispositivo.'
  if (!DEVICE_UID_PATTERN.test(uid)) {
    return 'Identificador inválido: de 3 a 50 caracteres entre letras, números, guion y guion bajo.'
  }
  return null
}

/**
 * Unidades a las que se puede vincular un dispositivo: activas y sin dispositivo (RN02: una
 * unidad tiene como máximo uno). El servidor decide igual: esto evita ofrecer lo que se sabe
 * que va a fallar.
 */
export const linkableUnits = (units: readonly AdminUnit[]): AdminUnit[] =>
  units.filter((unit) => unit.activa && unit.dispositivo === null)

export const unitOptionLabel = (unit: AdminUnit): string => {
  const description = [unit.marca, unit.modelo].filter(Boolean).join(' ')
  return description ? `${unit.patente} · ${description}` : unit.patente
}

// Texto + ícono + tono por estado: el significado nunca depende solo del color.
const DEVICE_STATUS: Record<EstadoDispositivo, StatusInfo> = {
  activo: { label: 'Activo', icon: '✓', tone: 'ok' },
  inactivo: { label: 'Inactivo', icon: '–', tone: 'neutral' },
  sin_reportar: { label: 'Sin reportar', icon: '▲', tone: 'warn' },
}

export const deviceStatusInfo = (estado: EstadoDispositivo): StatusInfo => DEVICE_STATUS[estado]
