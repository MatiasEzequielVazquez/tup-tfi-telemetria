import { useEffect, useRef } from 'react'
import { useChartColors } from '../../hooks/useChartColors'
import type { ChartColors } from '../../utils/chartColors'
import { echarts, type EChartsCoreOption } from './echarts'

interface EChartProps {
  /**
   * Arma la opción de ECharts a partir de los colores del tema. Tiene que ser estable entre
   * renders (useMemo/useCallback): cada cambio de identidad vuelve a dibujar el gráfico.
   */
  buildOption: (colors: ChartColors) => EChartsCoreOption
  /** Alto total en px, con el eje incluido: el gráfico se acomoda adentro, sin scroll propio. */
  height: number
  /** Resumen de lo que muestra, para lectores de pantalla. El detalle va en la tabla de datos. */
  ariaLabel: string
  /** Mientras se actualizan los datos, se conserva el dibujo anterior atenuado. */
  dimmed?: boolean
}

const prefersReducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Gráfico de ECharts sobre canvas: se adapta al ancho, al tema claro/oscuro y se libera al desmontar. */
const EChart = ({ buildOption, height, ariaLabel, dimmed = false }: EChartProps) => {
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null)
  const colors = useChartColors()

  useEffect(() => {
    const element = container.current
    if (!element) return
    const instance = echarts.init(element, undefined, { renderer: 'canvas' })
    chart.current = instance
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(
      { ...buildOption(colors), animation: !prefersReducedMotion() },
      { notMerge: true },
    )
  }, [buildOption, colors])

  return (
    <div
      ref={container}
      role="img"
      aria-label={ariaLabel}
      style={{ height }}
      className={`w-full transition-opacity ${dimmed ? 'opacity-60' : ''}`}
    />
  )
}

export default EChart
