// Las fechas de la API son ISO 8601 en UTC. Se muestran en hora de Buenos Aires, que es la
// del taller (caso de estudio), sin depender de la zona horaria del navegador.
const TIME_ZONE = 'America/Argentina/Buenos_Aires'

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})
const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: TIME_ZONE })

export const formatDateTime = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormatter.format(date)
}

export const formatDate = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateFormatter.format(date)
}

const todayParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** El día de hoy en Buenos Aires como `YYYY-MM-DD`, sin depender de la zona del navegador. */
export const todayDateOnly = (now: Date = new Date()): string => {
  const part = (type: string) => todayParts.formatToParts(now).find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Una fecha sin hora (`YYYY-MM-DD`, como `services.fecha`) es un día de calendario, no un
// instante: pasarla por `formatDate` la tomaría como medianoche UTC y en Buenos Aires
// (UTC-3) se vería el día anterior. Se formatea en UTC para que el día no se corra.
const dateOnlyFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export const formatDateOnly = (value: string): string => {
  const match = DATE_ONLY.exec(value)
  if (!match) return value
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rechaza días que no existen (2026-02-30), que Date correría al mes siguiente.
  return date.getUTCMonth() === month - 1 ? dateOnlyFormatter.format(date) : value
}
