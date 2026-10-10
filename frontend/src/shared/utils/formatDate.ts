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
