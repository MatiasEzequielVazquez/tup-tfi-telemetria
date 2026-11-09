import { formatKm } from '../../../shared/utils/formatKm'
import { formatDuration, formatInteger, formatPercent } from './format'
import type { FleetKpis } from './metrics'

export interface Kpi {
  id: string
  label: string
  value: string
  hint: string
}

const plural = (count: number, one: string, many: string): string => `${formatInteger(count)} ${count === 1 ? one : many}`

/** Los indicadores de arriba de la pantalla, ya con el texto que se muestra. */
export const buildKpis = (k: FleetKpis, now: Date = new Date()): Kpi[] => [
  {
    id: 'units',
    label: 'Unidades activas',
    value: formatInteger(k.units),
    hint: `${formatInteger(k.reporting)} reportando · ${formatInteger(k.withDevice)} con dispositivo`,
  },
  {
    id: 'km-average',
    label: 'Km promedio por unidad',
    value: k.units ? formatKm(Math.round(k.kmAverage)) : '–',
    hint: `Total de la flota: ${formatKm(Math.round(k.kmTotal))}`,
  },
  {
    id: 'up-to-date',
    label: 'Unidades al día',
    value: k.withPlan ? formatPercent(k.upToDate / k.withPlan) : '–',
    hint: k.withPlan
      ? `${formatInteger(k.upToDate)} de ${plural(k.withPlan, 'unidad con plan', 'unidades con plan')}`
      : 'Ninguna unidad tiene plan de mantenimiento',
  },
  {
    id: 'open-alerts',
    label: 'Alertas abiertas',
    value: formatInteger(k.openAlerts),
    hint: k.oldestOpenAlert
      ? `La más antigua, hace ${formatDuration((now.getTime() - Date.parse(k.oldestOpenAlert)) / 3_600_000)}`
      : 'Ninguna pendiente de revisión',
  },
  {
    id: 'review-time',
    label: 'Tiempo medio de revisión',
    value: k.meanReviewHours === null ? '–' : formatDuration(k.meanReviewHours),
    hint: `${plural(k.reviewedAlerts, 'alerta revisada', 'alertas revisadas')}`,
  },
  {
    id: 'faults',
    label: 'Unidades con fallas activas',
    value: formatInteger(k.unitsWithFaults),
    hint: `${plural(k.activeFaults, 'falla activa', 'fallas activas')} en total`,
  },
]
