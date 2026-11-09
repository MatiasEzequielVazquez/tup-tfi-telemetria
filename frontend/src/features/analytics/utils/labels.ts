import type { EstadoMantenimiento, Tenencia, TipoAlerta } from '../types'

// Mismo texto e ícono que en el resto de la aplicación: el significado nunca depende solo del color.

/** En orden de gravedad, para que cada estado conserve siempre su lugar en el gráfico. */
export const MAINTENANCE_STATES: { key: EstadoMantenimiento; label: string; icon: string }[] = [
  { key: 'vencida', label: 'Vencida', icon: '✕' },
  { key: 'proxima', label: 'Próxima', icon: '▲' },
  { key: 'postergada', label: 'Postergada', icon: '❚❚' },
  { key: 'al_dia', label: 'Al día', icon: '✓' },
  { key: 'sin_plan', label: 'Sin plan', icon: '–' },
]

export const TENENCIAS: { key: Tenencia; label: string }[] = [
  { key: 'propia', label: 'Propia' },
  { key: 'fletero', label: 'Fletero' },
]

export const ALERT_TYPES: { key: TipoAlerta; label: string }[] = [
  { key: 'tarea_vencida', label: 'Tarea vencida' },
  { key: 'tarea_proxima', label: 'Tarea próxima' },
  { key: 'falla_nueva', label: 'Falla nueva' },
  { key: 'dispositivo_sin_reportar', label: 'Dispositivo sin reportar' },
]
