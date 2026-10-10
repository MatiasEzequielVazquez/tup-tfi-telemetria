import type {
  EstadoDispositivo,
  EstadoPlan,
  FuenteKm,
  MotivoPostergacion,
  Protocolo,
  Tenencia,
} from '../../../api/types'
import type { StatusInfo } from '../../../shared/components/ui/StatusBadge'

// Textos e íconos con que se muestran las enumeraciones del contrato. El estado de cada
// tarea lo calcula la API; acá solo se traduce a texto.

const ESTADO_PLAN: Record<EstadoPlan, StatusInfo> = {
  al_dia: { label: 'Al día', icon: '✓', tone: 'ok' },
  proxima: { label: 'Próxima', icon: '▲', tone: 'warn' },
  vencida: { label: 'Vencida', icon: '✕', tone: 'danger' },
  postergada: { label: 'Postergada', icon: '❚❚', tone: 'postponed' },
}

export const estadoPlanInfo = (estado: EstadoPlan): StatusInfo => ESTADO_PLAN[estado]

/** `estado_mantenimiento` de la flota es `null` cuando la unidad no tiene planes. */
export const estadoMantenimientoInfo = (estado: EstadoPlan | null): StatusInfo =>
  estado === null
    ? { label: 'Sin plan de mantenimiento', icon: '–', tone: 'neutral' }
    : ESTADO_PLAN[estado]

const ESTADO_DISPOSITIVO: Record<EstadoDispositivo, StatusInfo> = {
  activo: { label: 'Activo', icon: '✓', tone: 'ok' },
  inactivo: { label: 'Inactivo', icon: '–', tone: 'neutral' },
  sin_reportar: { label: 'Sin reportar', icon: '▲', tone: 'warn' },
}

export const estadoDispositivoInfo = (estado: EstadoDispositivo): StatusInfo =>
  ESTADO_DISPOSITIVO[estado]

/** La unidad no tiene dispositivo vinculado (`dispositivo: null`). */
export const SIN_DISPOSITIVO: StatusInfo = { label: 'Sin dispositivo', icon: '–', tone: 'neutral' }

export const TENENCIA_LABEL: Record<Tenencia, string> = {
  propia: 'Propia',
  fletero: 'Fletero',
}

export const PROTOCOLO_LABEL: Record<Protocolo, string> = {
  J1939: 'J1939',
  J1979: 'J1979',
}

export const FUENTE_KM_LABEL: Record<FuenteKm, string> = {
  odometro: 'Odómetro',
  estimado: 'Estimado',
  manual: 'Carga manual',
}

export const MOTIVO_LABEL: Record<MotivoPostergacion, string> = {
  falta_espacio: 'Falta de espacio en el taller',
  salida_urgente: 'Salida urgente',
  otro: 'Otro',
}
