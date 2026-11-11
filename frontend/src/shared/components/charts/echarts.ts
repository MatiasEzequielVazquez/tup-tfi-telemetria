// ECharts con solo lo que usa la aplicación (barras sobre canvas): así el paquete no trae
// todos los tipos de gráfico. Para sumar uno nuevo (línea, torta…), registrarlo acá.
import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

export { echarts }
export type { EChartsCoreOption } from 'echarts/core'
