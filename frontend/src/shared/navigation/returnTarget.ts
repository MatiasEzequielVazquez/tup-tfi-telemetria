/**
 * Destino de regreso que una pantalla le pasa a otra al navegar (en el `state` del router),
 * para que "Volver" lleve al listado de origen con sus filtros. No conoce rutas concretas:
 * quien navega informa a dónde volver y cómo llamarlo.
 */
export interface ReturnTarget {
  path: string
  /** Texto para el enlace: "Volver a {label}". */
  label: string
}

interface ReturnState {
  returnTo: ReturnTarget
}

export const returnState = (path: string, label: string): ReturnState => ({
  returnTo: { path, label },
})

const isInternalPath = (value: string): boolean =>
  value.startsWith('/') && !value.startsWith('//') && !value.includes('://')

/** Lee el destino de regreso del `state`; si falta o no es válido, devuelve `fallback`. */
export const readReturnTarget = (state: unknown, fallback: ReturnTarget): ReturnTarget => {
  if (typeof state !== 'object' || state === null) return fallback
  const candidate = (state as Partial<ReturnState>).returnTo
  if (typeof candidate !== 'object' || candidate === null) return fallback
  const { path, label } = candidate as Partial<ReturnTarget>
  if (typeof path !== 'string' || typeof label !== 'string') return fallback
  if (!isInternalPath(path) || label.trim() === '' || label.length > 60) return fallback
  return { path, label }
}
