const kmFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export const formatKm = (km: number): string => `${kmFormatter.format(km)} km`
