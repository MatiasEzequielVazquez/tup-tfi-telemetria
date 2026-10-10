import type { StatusInfo } from '../../../shared/components/ui/StatusBadge'
import type { EstadoAlerta, OrigenAlerta, TipoAlerta } from '../types'

// Texto + ícono + tono por tipo y estado: el significado nunca depende solo del color.
// El orden de las claves es el del selector de tipo.
export const ALERT_TYPE_INFO: Record<TipoAlerta, StatusInfo> = {
  tarea_proxima: { label: 'Tarea próxima', icon: '▲', tone: 'warn' },
  tarea_vencida: { label: 'Tarea vencida', icon: '✕', tone: 'danger' },
  falla_nueva: { label: 'Falla nueva', icon: '!', tone: 'postponed' },
  dispositivo_sin_reportar: { label: 'Dispositivo sin reportar', icon: '–', tone: 'neutral' },
}

export const ALERT_STATUS_INFO: Record<EstadoAlerta, StatusInfo> = {
  abierta: { label: 'Abierta', icon: '●', tone: 'warn' },
  revisada: { label: 'Revisada', icon: '✓', tone: 'ok' },
}

/** Qué representa `referencia` según el origen de la alerta. */
export const REFERENCE_LABEL: Record<OrigenAlerta, string> = {
  plan: 'Tarea',
  falla: 'Código de falla',
  dispositivo: 'Dispositivo',
}
