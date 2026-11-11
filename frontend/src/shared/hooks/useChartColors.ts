import { useSyncExternalStore } from 'react'
import { readChartColors, type ChartColors } from '../utils/chartColors'

const DARK_QUERY = '(prefers-color-scheme: dark)'

const subscribe = (onChange: () => void): (() => void) => {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const sameColors = (a: ChartColors, b: ChartColors): boolean =>
  (Object.keys(a) as (keyof ChartColors)[]).every((key) => a[key] === b[key])

let cached: ChartColors | null = null

// React llama a esto en cada render y exige la misma referencia si nada cambió: de ahí el caché.
const getSnapshot = (): ChartColors => {
  const next = readChartColors(getComputedStyle(document.documentElement))
  if (cached && sameColors(cached, next)) return cached
  cached = next
  return next
}

/** Colores del tema actual para los gráficos; se vuelven a leer cuando cambia claro/oscuro. */
export const useChartColors = (): ChartColors => useSyncExternalStore(subscribe, getSnapshot)
