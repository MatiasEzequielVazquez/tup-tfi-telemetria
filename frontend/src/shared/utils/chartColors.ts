/** Colores que necesita un gráfico, leídos de las variables CSS del tema (src/css/main.css). */
export interface ChartColors {
  /** Texto principal (valores, leyenda). */
  text: string
  /** Texto secundario (ejes). */
  textMuted: string
  /** Líneas finas: grilla y ejes. */
  line: string
  /** Fondo de la tarjeta: separa los segmentos y los tooltips. */
  surface: string
  /** Serie principal. */
  series: string
  /** Gris de énfasis: lo que acompaña a la serie principal sin competir con ella. */
  muted: string
  ok: string
  warn: string
  serious: string
  danger: string
}

const VARIABLES: Record<keyof ChartColors, string> = {
  text: '--fg',
  textMuted: '--muted',
  line: '--line',
  surface: '--surface',
  series: '--chart-series',
  muted: '--chart-muted',
  ok: '--chart-ok',
  warn: '--chart-warn',
  serious: '--chart-serious',
  danger: '--chart-danger',
}

// Valores del tema claro, por si las variables no están disponibles (pruebas, estilos sin cargar).
const FALLBACK: ChartColors = {
  text: '#1c2430',
  textMuted: '#5b6676',
  line: '#d5dae1',
  surface: '#ffffff',
  series: '#2a78d6',
  muted: '#898781',
  ok: '#0ca30c',
  warn: '#fab219',
  serious: '#ec835a',
  danger: '#d03b3b',
}

export const readChartColors = (style: Pick<CSSStyleDeclaration, 'getPropertyValue'>): ChartColors => {
  const colors = { ...FALLBACK }
  for (const key of Object.keys(VARIABLES) as (keyof ChartColors)[]) {
    const value = style.getPropertyValue(VARIABLES[key]).trim()
    if (value) colors[key] = value
  }
  return colors
}
