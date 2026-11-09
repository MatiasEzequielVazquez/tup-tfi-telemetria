import type { EChartsCoreOption } from '../../../shared/components/charts/echarts'
import type { ChartColors } from '../../../shared/utils/chartColors'
import { formatDateOnly, todayDateOnly } from '../../../shared/utils/formatDate'
import { formatKm } from '../../../shared/utils/formatKm'
import type { Alerta, EstadoMantenimiento, Unidad } from '../types'
import { escapeHtml, formatCompact, formatInteger, formatShortDay } from './format'
import { ALERT_TYPES, MAINTENANCE_STATES, TENENCIAS } from './labels'
import {
  alertsByType,
  alertsPerDay,
  averageKmByTenure,
  maintenanceCounts,
  topFaultCodes,
  topUnitsByKm,
} from './metrics'

/*
 * Definición de cada gráfico: qué muestra, con qué opción de ECharts y cuál es su tabla de
 * datos (la vía de lectura que no depende de la vista ni del puntero). Funciones puras:
 * reciben los datos y devuelven la especificación; nada de React.
 *
 * Criterios (guía dataviz): barras finas con la punta redondeada y el nacimiento recto; grilla
 * de un solo trazo, fina y continua; una sola serie lleva un solo color y no lleva leyenda;
 * el valor va en la punta; los estados usan la paleta de estado con ícono y texto.
 */

export interface TableData {
  columns: string[]
  rows: string[][]
}

export interface ChartSpec {
  id: string
  title: string
  description: string
  /** Resumen para lectores de pantalla. */
  ariaLabel: string
  /** Alto total en px, con el eje incluido. */
  height: number
  /** Si hay un mensaje, no se dibuja el gráfico y se muestra este texto. */
  empty: string | null
  buildOption: (colors: ChartColors) => EChartsCoreOption
  table: TableData
}

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const BAR_WIDTH = 16

// ---- piezas comunes -------------------------------------------------------------------

const textStyle = (colors: ChartColors, color = colors.textMuted) => ({ color, fontSize: 12, fontFamily: FONT_FAMILY })
const hairline = (colors: ChartColors) => ({ lineStyle: { color: colors.line, width: 1, type: 'solid' as const } })

const tooltipBase = (colors: ChartColors) => ({
  backgroundColor: colors.surface,
  borderColor: colors.line,
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: colors.text, fontSize: 13, fontFamily: FONT_FAMILY },
  extraCssText: 'box-shadow: none;',
})

interface TipRow {
  label: string
  value: string
  color?: string
}

/**
 * Contenido del tooltip: el valor manda y la etiqueta acompaña. El texto viene de la API
 * (patentes, códigos de falla que informan los dispositivos), así que siempre se escapa.
 */
const tooltipHtml = (title: string, rows: TipRow[]): string =>
  `<div style="margin-bottom:4px;font-weight:600">${escapeHtml(title)}</div>${rows
    .map(
      (row) =>
        `<div style="display:flex;align-items:center;gap:6px">${
          row.color ? `<span style="display:inline-block;width:10px;height:3px;border-radius:2px;background:${row.color}"></span>` : ''
        }<strong>${escapeHtml(row.value)}</strong><span style="opacity:.75">${escapeHtml(row.label)}</span></div>`,
    )
    .join('')}`

interface HorizontalBars {
  colors: ChartColors
  categories: string[]
  /** `null` = sin dato: no se dibuja la barra. */
  values: (number | null)[]
  colorAt?: (index: number) => string
  formatValue: (value: number) => string
  tooltip: (index: number) => string
  integerAxis?: boolean
  /** Texto de las marcas del eje de valores (por defecto, ECharts usa separador inglés). */
  formatAxis?: (value: number) => string
}

/** Barras horizontales de una serie, con el valor en la punta. */
const horizontalBars = ({ colors, categories, values, colorAt, formatValue, tooltip, integerAxis, formatAxis = formatInteger }: HorizontalBars): EChartsCoreOption => ({
  textStyle: textStyle(colors),
  grid: { left: 8, right: 72, top: 8, bottom: 4, containLabel: true },
  tooltip: { ...tooltipBase(colors), trigger: 'item', formatter: (p: { dataIndex: number }) => tooltip(p.dataIndex) },
  xAxis: {
    type: 'value',
    min: 0,
    minInterval: integerAxis ? 1 : undefined,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { ...textStyle(colors), formatter: formatAxis, hideOverlap: true },
    splitLine: hairline(colors),
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: categories,
    axisTick: { show: false },
    axisLine: hairline(colors),
    axisLabel: { ...textStyle(colors, colors.text), width: 150, overflow: 'truncate' },
  },
  series: [
    {
      type: 'bar',
      barWidth: BAR_WIDTH,
      data: values.map((value, index) => ({
        value,
        itemStyle: { color: colorAt?.(index) ?? colors.series, borderRadius: [0, 4, 4, 0] },
      })),
      label: {
        show: true,
        position: 'right',
        ...textStyle(colors, colors.text),
        formatter: (p: { value: number | null }) => (p.value === null ? '' : formatValue(p.value)),
      },
      emphasis: { itemStyle: { opacity: 0.8 } },
    },
  ],
})

const barsHeight = (rows: number): number => rows * 34 + 44

// ---- los seis gráficos ------------------------------------------------------------------

const statusColor = (state: EstadoMantenimiento, colors: ChartColors): string =>
  ({ vencida: colors.danger, proxima: colors.warn, postergada: colors.serious, al_dia: colors.ok, sin_plan: colors.muted })[state]

export const maintenanceSpec = (units: Unidad[]): ChartSpec => {
  const counts = maintenanceCounts(units)
  const labelOf = (key: EstadoMantenimiento) => MAINTENANCE_STATES.find((s) => s.key === key)!
  const names = counts.map(({ key }) => `${labelOf(key).icon} ${labelOf(key).label}`)

  return {
    id: 'maintenance',
    title: 'Estado de mantenimiento',
    description: 'Unidades activas según su tarea más crítica.',
    ariaLabel: `Unidades por estado de mantenimiento: ${counts.map(({ key, count }) => `${labelOf(key).label} ${count}`).join(', ')}.`,
    height: barsHeight(counts.length),
    empty: units.length ? null : 'No hay unidades activas.',
    buildOption: (colors) =>
      horizontalBars({
        colors,
        categories: names,
        values: counts.map(({ count }) => count),
        colorAt: (i) => statusColor(counts[i].key, colors),
        formatValue: formatInteger,
        integerAxis: true,
        tooltip: (i) =>
          tooltipHtml(names[i], [{ label: counts[i].count === 1 ? 'unidad' : 'unidades', value: formatInteger(counts[i].count), color: statusColor(counts[i].key, colors) }]),
      }),
    table: {
      columns: ['Estado', 'Unidades'],
      rows: counts.map(({ key, count }) => [labelOf(key).label, formatInteger(count)]),
    },
  }
}

export const kmByTenureSpec = (units: Unidad[]): ChartSpec => {
  const rows = averageKmByTenure(units)
  const labelOf = (key: string) => TENENCIAS.find((t) => t.key === key)!.label
  const names = rows.map((row) => labelOf(row.key))

  return {
    id: 'km-by-tenure',
    title: 'Km promedio por tenencia',
    description: 'Kilómetros promedio de las unidades activas, propias y de fleteros.',
    ariaLabel: `Km promedio por tenencia: ${rows.map((r) => `${labelOf(r.key)} ${r.averageKm === null ? 'sin unidades' : formatKm(Math.round(r.averageKm))}`).join(', ')}.`,
    height: barsHeight(rows.length),
    empty: units.length ? null : 'No hay unidades activas.',
    buildOption: (colors) =>
      horizontalBars({
        colors,
        categories: names,
        values: rows.map((row) => row.averageKm),
        formatValue: (value) => formatKm(Math.round(value)),
        formatAxis: formatCompact,
        tooltip: (i) =>
          rows[i].averageKm === null
            ? tooltipHtml(names[i], [{ label: 'sin unidades', value: '–' }])
            : tooltipHtml(names[i], [
                { label: 'promedio', value: formatKm(Math.round(rows[i].averageKm)), color: colors.series },
                { label: rows[i].units === 1 ? 'unidad' : 'unidades', value: formatInteger(rows[i].units) },
              ]),
      }),
    table: {
      columns: ['Tenencia', 'Unidades', 'Km promedio'],
      rows: rows.map((row) => [labelOf(row.key), formatInteger(row.units), row.averageKm === null ? '–' : formatKm(Math.round(row.averageKm))]),
    },
  }
}

export const topKmSpec = (units: Unidad[], limit = 10): ChartSpec => {
  const top = topUnitsByKm(units, limit)

  return {
    id: 'top-km',
    title: `Unidades con más kilómetros`,
    description: `Las ${limit} unidades activas con mayor kilometraje.`,
    ariaLabel: `Unidades con más kilómetros: ${top.map((t) => `${t.patente} ${formatKm(t.km)}`).join(', ')}.`,
    height: barsHeight(top.length),
    empty: top.length ? null : 'No hay unidades activas.',
    buildOption: (colors) =>
      horizontalBars({
        colors,
        categories: top.map((t) => t.patente),
        values: top.map((t) => t.km),
        formatValue: (value) => formatKm(Math.round(value)),
        formatAxis: formatCompact,
        tooltip: (i) => tooltipHtml(top[i].patente, [{ label: 'recorridos', value: formatKm(top[i].km), color: colors.series }]),
      }),
    table: { columns: ['Unidad', 'Km'], rows: top.map((t) => [t.patente, formatKm(t.km)]) },
  }
}

export const alertsByTypeSpec = (alerts: Alerta[]): ChartSpec => {
  const rows = alertsByType(alerts)
  const labelOf = (key: string) => ALERT_TYPES.find((t) => t.key === key)!.label
  const names = rows.map((row) => labelOf(row.key))
  const total = rows.reduce((sum, row) => sum + row.open + row.reviewed, 0)

  return {
    id: 'alerts-by-type',
    title: 'Alertas por tipo',
    description: 'Abiertas y revisadas, de todo el historial.',
    ariaLabel: `Alertas por tipo: ${rows.map((r) => `${labelOf(r.key)} ${r.open} abiertas y ${r.reviewed} revisadas`).join('; ')}.`,
    height: barsHeight(rows.length) + 28,
    empty: total ? null : 'Todavía no hay alertas.',
    buildOption: (colors) => {
      // Un hueco del color de la tarjeta separa los segmentos: no hay bordes dibujados.
      const segment = (name: string, key: 'open' | 'reviewed', color: string, radius: number[]) => ({
        name,
        type: 'bar' as const,
        stack: 'alertas',
        barWidth: BAR_WIDTH,
        data: rows.map((row) => row[key]),
        itemStyle: { color, borderColor: colors.surface, borderWidth: 2, borderRadius: radius },
        emphasis: { itemStyle: { opacity: 0.8 } },
      })
      return {
        textStyle: textStyle(colors),
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 8, icon: 'roundRect', textStyle: textStyle(colors, colors.text) },
        grid: { left: 8, right: 16, top: 32, bottom: 4, containLabel: true },
        tooltip: {
          ...tooltipBase(colors),
          trigger: 'axis',
          axisPointer: { type: 'shadow', shadowStyle: { color: colors.line, opacity: 0.25 } },
          formatter: (params: { dataIndex: number }[]) => {
            const row = rows[params[0].dataIndex]
            return tooltipHtml(labelOf(row.key), [
              { label: 'abiertas', value: formatInteger(row.open), color: colors.series },
              { label: 'revisadas', value: formatInteger(row.reviewed), color: colors.muted },
            ])
          },
        },
        xAxis: { type: 'value', min: 0, minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...textStyle(colors), formatter: formatInteger }, splitLine: hairline(colors) },
        yAxis: {
          type: 'category',
          inverse: true,
          data: names,
          axisTick: { show: false },
          axisLine: hairline(colors),
          axisLabel: { ...textStyle(colors, colors.text), width: 150, overflow: 'truncate' },
        },
        series: [segment('Abiertas', 'open', colors.series, [0, 0, 0, 0]), segment('Revisadas', 'reviewed', colors.muted, [0, 4, 4, 0])],
      }
    },
    table: {
      columns: ['Tipo', 'Abiertas', 'Revisadas'],
      rows: rows.map((row) => [labelOf(row.key), formatInteger(row.open), formatInteger(row.reviewed)]),
    },
  }
}

export const alertsPerDaySpec = (alerts: Alerta[], days = 30, today: string = todayDateOnly()): ChartSpec => {
  const perDay = alertsPerDay(alerts, days, today)
  const total = perDay.reduce((sum, day) => sum + day.count, 0)
  const busiest = perDay.reduce((best, day) => (day.count > best.count ? day : best), perDay[0])

  return {
    id: 'alerts-per-day',
    title: `Alertas generadas por día`,
    description: `Últimos ${days} días, de todos los tipos.`,
    ariaLabel: total
      ? `Alertas generadas por día en los últimos ${days} días: ${total} en total; el día con más fue el ${formatDateOnly(busiest.date)}, con ${busiest.count}.`
      : `No se generaron alertas en los últimos ${days} días.`,
    height: 264,
    empty: total ? null : `No se generaron alertas en los últimos ${days} días.`,
    buildOption: (colors) => ({
      textStyle: textStyle(colors),
      grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase(colors),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: colors.line, opacity: 0.25 } },
        formatter: (params: { dataIndex: number }[]) => {
          const day = perDay[params[0].dataIndex]
          return tooltipHtml(formatDateOnly(day.date), [{ label: day.count === 1 ? 'alerta' : 'alertas', value: formatInteger(day.count), color: colors.series }])
        },
      },
      xAxis: {
        type: 'category',
        data: perDay.map((day) => formatShortDay(day.date)),
        axisTick: { show: false },
        axisLine: hairline(colors),
        axisLabel: { ...textStyle(colors), hideOverlap: true },
      },
      yAxis: { type: 'value', min: 0, minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...textStyle(colors), formatter: formatInteger }, splitLine: hairline(colors) },
      series: [
        {
          type: 'bar',
          barMaxWidth: BAR_WIDTH,
          data: perDay.map((day) => day.count),
          itemStyle: { color: colors.series, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { opacity: 0.8 } },
        },
      ],
    }),
    table: { columns: ['Día', 'Alertas'], rows: perDay.map((day) => [formatDateOnly(day.date), formatInteger(day.count)]) },
  }
}

export const topFaultsSpec = (alerts: Alerta[], limit = 8): ChartSpec => {
  const top = topFaultCodes(alerts, limit)

  return {
    id: 'top-faults',
    title: 'Fallas más frecuentes',
    description: 'Códigos de falla con más apariciones, de todas las unidades.',
    ariaLabel: top.length
      ? `Fallas más frecuentes: ${top.map((t) => `${t.code} ${t.count}`).join(', ')}.`
      : 'Todavía no se registraron fallas.',
    height: barsHeight(top.length),
    empty: top.length ? null : 'Todavía no se registraron fallas.',
    buildOption: (colors) =>
      horizontalBars({
        colors,
        categories: top.map((t) => t.code),
        values: top.map((t) => t.count),
        formatValue: formatInteger,
        integerAxis: true,
        tooltip: (i) => tooltipHtml(top[i].code, [{ label: top[i].count === 1 ? 'aparición' : 'apariciones', value: formatInteger(top[i].count), color: colors.series }]),
      }),
    table: { columns: ['Código', 'Apariciones'], rows: top.map((t) => [t.code, formatInteger(t.count)]) },
  }
}

/** Los seis gráficos de la pantalla, en el orden en que se muestran. */
export const buildChartSpecs = (units: Unidad[], alerts: Alerta[], today: string = todayDateOnly()): ChartSpec[] => [
  maintenanceSpec(units),
  kmByTenureSpec(units),
  topKmSpec(units),
  alertsByTypeSpec(alerts),
  alertsPerDaySpec(alerts, 30, today),
  topFaultsSpec(alerts),
]
