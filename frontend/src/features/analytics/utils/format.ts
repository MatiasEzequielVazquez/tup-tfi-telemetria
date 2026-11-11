const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

/** Una duración en horas, en la unidad que se lee mejor: minutos, horas o días. */
export const formatDuration = (hours: number): string => {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${decimal.format(hours)} h`
  return `${decimal.format(hours / 24)} d`
}

/** `2026-11-09` → `09/11`. */
export const formatShortDay = (dateOnly: string): string => {
  const [, month, day] = dateOnly.split('-')
  return `${day}/${month}`
}

export const formatPercent = (share: number): string => `${Math.round(share * 100)} %`

export const formatInteger = (value: number): string => decimal.format(value)

const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })

/** Marcas de un eje que llega a cientos de miles: 100 mil, 1 M. */
export const formatCompact = (value: number): string => compact.format(value)

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
