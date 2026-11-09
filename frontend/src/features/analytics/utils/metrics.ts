import { todayDateOnly, toDateOnly } from '../../../shared/utils/formatDate'
import type { Alerta, EstadoMantenimiento, Tenencia, TipoAlerta, Unidad } from '../types'
import { ALERT_TYPES, MAINTENANCE_STATES, TENENCIAS } from './labels'

// Cálculos puros sobre lo que devuelve la API. Sin React ni ECharts: se prueban solos.

const HOUR_MS = 3_600_000

export interface FleetKpis {
  units: number
  withDevice: number
  reporting: number
  kmTotal: number
  kmAverage: number
  withPlan: number
  upToDate: number
  openAlerts: number
  /** ISO de la alerta abierta más antigua. */
  oldestOpenAlert: string | null
  reviewedAlerts: number
  /** Promedio entre que se genera una alerta y se revisa; `null` si ninguna se revisó. */
  meanReviewHours: number | null
  unitsWithFaults: number
  activeFaults: number
}

export const fleetKpis = (units: Unidad[], alerts: Alerta[]): FleetKpis => {
  const kmTotal = units.reduce((sum, unit) => sum + unit.km_actual, 0)

  const open = alerts.filter((alert) => alert.estado === 'abierta')
  const oldestOpenAlert = open.reduce<string | null>(
    (oldest, alert) => (oldest === null || Date.parse(alert.fecha_generada) < Date.parse(oldest) ? alert.fecha_generada : oldest),
    null,
  )

  const reviewHours = alerts.flatMap((alert) => {
    if (alert.estado !== 'revisada' || !alert.fecha_revisada) return []
    const hours = (Date.parse(alert.fecha_revisada) - Date.parse(alert.fecha_generada)) / HOUR_MS
    return Number.isFinite(hours) && hours >= 0 ? [hours] : []
  })

  return {
    units: units.length,
    withDevice: units.filter((unit) => unit.dispositivo !== null).length,
    reporting: units.filter((unit) => unit.dispositivo?.estado === 'activo').length,
    kmTotal,
    kmAverage: units.length ? kmTotal / units.length : 0,
    withPlan: units.filter((unit) => unit.estado_mantenimiento !== null).length,
    upToDate: units.filter((unit) => unit.estado_mantenimiento === 'al_dia').length,
    openAlerts: open.length,
    oldestOpenAlert,
    reviewedAlerts: reviewHours.length,
    meanReviewHours: reviewHours.length ? reviewHours.reduce((a, b) => a + b, 0) / reviewHours.length : null,
    unitsWithFaults: units.filter((unit) => unit.fallas_activas > 0).length,
    activeFaults: units.reduce((sum, unit) => sum + unit.fallas_activas, 0),
  }
}

/** Cantidad de unidades por estado de mantenimiento, siempre en el mismo orden (de más a menos grave). */
export const maintenanceCounts = (units: Unidad[]): { key: EstadoMantenimiento; count: number }[] =>
  MAINTENANCE_STATES.map(({ key }) => ({
    key,
    count: units.filter((unit) => (unit.estado_mantenimiento ?? 'sin_plan') === key).length,
  }))

export interface TenureKm {
  key: Tenencia
  units: number
  /** `null` si no hay unidades de esa tenencia. */
  averageKm: number | null
}

export const averageKmByTenure = (units: Unidad[]): TenureKm[] =>
  TENENCIAS.map(({ key }) => {
    const group = units.filter((unit) => unit.tenencia === key)
    return {
      key,
      units: group.length,
      averageKm: group.length ? group.reduce((sum, unit) => sum + unit.km_actual, 0) / group.length : null,
    }
  })

export const topUnitsByKm = (units: Unidad[], limit = 10): { patente: string; km: number }[] =>
  [...units]
    .sort((a, b) => b.km_actual - a.km_actual || a.patente.localeCompare(b.patente))
    .slice(0, limit)
    .map((unit) => ({ patente: unit.patente, km: unit.km_actual }))

export const alertsByType = (alerts: Alerta[]): { key: TipoAlerta; open: number; reviewed: number }[] =>
  ALERT_TYPES.map(({ key }) => ({
    key,
    open: alerts.filter((alert) => alert.tipo === key && alert.estado === 'abierta').length,
    reviewed: alerts.filter((alert) => alert.tipo === key && alert.estado === 'revisada').length,
  }))

/** Suma días a una fecha `YYYY-MM-DD` (aritmética de calendario, sin zonas horarias de por medio). */
export const shiftDateOnly = (dateOnly: string, days: number): string => {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** Alertas generadas por día calendario (Buenos Aires) en los últimos `days` días, hasta `today` (`YYYY-MM-DD`) incluido. */
export const alertsPerDay = (alerts: Alerta[], days = 30, today: string = todayDateOnly()): { date: string; count: number }[] => {
  const counts = new Map<string, number>()
  for (let back = days - 1; back >= 0; back -= 1) counts.set(shiftDateOnly(today, -back), 0)

  for (const alert of alerts) {
    const generated = new Date(alert.fecha_generada)
    if (Number.isNaN(generated.getTime())) continue
    const day = toDateOnly(generated)
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts].map(([date, count]) => ({ date, count }))
}

/** Códigos de falla con más apariciones (cada aparición genera una alerta de falla nueva). */
export const topFaultCodes = (alerts: Alerta[], limit = 8): { code: string; count: number }[] => {
  const counts = new Map<string, number>()
  for (const alert of alerts) {
    if (alert.origen !== 'falla') continue
    counts.set(alert.referencia, (counts.get(alert.referencia) ?? 0) + 1)
  }
  return [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, limit)
}
