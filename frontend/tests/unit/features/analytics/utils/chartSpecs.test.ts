import { describe, expect, it } from 'vitest'
import {
  alertsByTypeSpec,
  alertsPerDaySpec,
  buildChartSpecs,
  kmByTenureSpec,
  maintenanceSpec,
  topFaultsSpec,
  topKmSpec,
} from '../../../../../src/features/analytics/utils/chartSpecs'
import type { ChartColors } from '../../../../../src/shared/utils/chartColors'
import { alert, unit } from '../fixtures'

const colors: ChartColors = {
  text: '#111111',
  textMuted: '#555555',
  line: '#dddddd',
  surface: '#ffffff',
  series: '#2a78d6',
  muted: '#898781',
  ok: '#0ca30c',
  warn: '#fab219',
  serious: '#ec835a',
  danger: '#d03b3b',
}

// La opción de ECharts es un objeto libre: en las pruebas se inspecciona sin tiparla.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Option = any
const option = (spec: { buildOption: (c: ChartColors) => unknown }): Option => spec.buildOption(colors)
const faultAlert = (code: string) => alert({ origen: 'falla', tipo: 'falla_nueva', referencia: code })

describe('buildChartSpecs', () => {
  it('arma los seis gráficos, cada uno con su tabla de datos', () => {
    const specs = buildChartSpecs([unit()], [alert()], '2026-11-09')
    expect(specs.map((s) => s.id)).toEqual([
      'maintenance',
      'km-by-tenure',
      'top-km',
      'alerts-by-type',
      'alerts-per-day',
      'top-faults',
    ])
    for (const spec of specs) {
      expect(spec.table.columns.length).toBeGreaterThan(1)
      expect(spec.ariaLabel.length).toBeGreaterThan(10)
      expect(spec.height).toBeGreaterThan(0)
    }
  })

  it('sin datos cada gráfico explica por qué está vacío en lugar de dibujar nada', () => {
    const specs = buildChartSpecs([], [], '2026-11-09')
    expect(specs.every((s) => typeof s.empty === 'string' && s.empty.length > 0)).toBe(true)
  })
})

describe('maintenanceSpec', () => {
  const spec = maintenanceSpec([
    unit({ estado_mantenimiento: 'vencida' }),
    unit({ estado_mantenimiento: 'al_dia' }),
    unit({ estado_mantenimiento: null }),
  ])

  it('usa la paleta de estado, con ícono y texto en cada categoría', () => {
    const o = option(spec)
    expect(o.yAxis.data).toEqual(['✕ Vencida', '▲ Próxima', '❚❚ Postergada', '✓ Al día', '– Sin plan'])
    expect(o.series[0].data.map((d: Option) => d.itemStyle.color)).toEqual([
      colors.danger,
      colors.warn,
      colors.serious,
      colors.ok,
      colors.muted,
    ])
    expect(o.series[0].data.map((d: Option) => d.value)).toEqual([1, 0, 0, 1, 1])
  })

  it('cumple las especificaciones de marcas: finas, punta redondeada, un solo eje, sin leyenda', () => {
    const o = option(spec)
    expect(o.series[0].barWidth).toBeLessThanOrEqual(24)
    expect(o.series[0].data[0].itemStyle.borderRadius).toEqual([0, 4, 4, 0])
    expect(Array.isArray(o.yAxis)).toBe(false)
    expect(Array.isArray(o.xAxis)).toBe(false)
    expect(o.legend).toBeUndefined()
    expect(o.xAxis.splitLine.lineStyle.type).toBe('solid')
  })

  it('la tabla tiene todos los estados', () => {
    expect(spec.table.rows).toEqual([
      ['Vencida', '1'],
      ['Próxima', '0'],
      ['Postergada', '0'],
      ['Al día', '1'],
      ['Sin plan', '1'],
    ])
  })
})

describe('kmByTenureSpec', () => {
  it('una tenencia sin unidades queda sin barra y se explica en la tabla', () => {
    const spec = kmByTenureSpec([unit({ km_actual: 2000 })])
    expect(option(spec).series[0].data.map((d: Option) => d.value)).toEqual([2000, null])
    expect(spec.table.rows).toEqual([
      ['Propia', '1', '2.000 km'],
      ['Fletero', '0', '–'],
    ])
  })
})

describe('topKmSpec', () => {
  it('limita a diez y ordena de mayor a menor', () => {
    const units = Array.from({ length: 15 }, (_, i) =>
      unit({ patente: `U${String(i).padStart(2, '0')}`, km_actual: i * 100 }),
    )
    const o = option(topKmSpec(units))
    expect(o.yAxis.data).toHaveLength(10)
    expect(o.yAxis.data[0]).toBe('U14')
  })
})

describe('alertsByTypeSpec', () => {
  const spec = alertsByTypeSpec([alert({ tipo: 'tarea_vencida' }), alert({ tipo: 'tarea_vencida', estado: 'revisada' })])

  it('apila abiertas (serie principal) y revisadas (gris de énfasis), separadas por el color de la tarjeta', () => {
    const o = option(spec)
    expect(o.series.map((s: Option) => s.name)).toEqual(['Abiertas', 'Revisadas'])
    expect(o.series[0].itemStyle.color).toBe(colors.series)
    expect(o.series[1].itemStyle.color).toBe(colors.muted)
    for (const s of o.series) {
      expect(s.stack).toBe('alertas')
      expect(s.itemStyle.borderColor).toBe(colors.surface)
      expect(s.itemStyle.borderWidth).toBe(2)
    }
  })

  it('con dos series hay leyenda', () => {
    expect(option(spec).legend).toBeDefined()
  })

  it('el tooltip lista las dos series', () => {
    const html: string = option(spec).tooltip.formatter([{ dataIndex: 0 }])
    expect(html).toContain('Tarea vencida')
    expect(html).toContain('abiertas')
    expect(html).toContain('revisadas')
  })
})

describe('alertsPerDaySpec', () => {
  it('dibuja los 30 días aunque haya ceros y no tiene leyenda (una serie)', () => {
    const spec = alertsPerDaySpec([alert({ fecha_generada: '2026-11-09T15:00:00Z' })], 30, '2026-11-09')
    const o = option(spec)
    expect(o.series[0].data).toHaveLength(30)
    expect(o.series[0].data.at(-1)).toBe(1)
    expect(o.legend).toBeUndefined()
    expect(spec.empty).toBeNull()
  })

  it('sin alertas en la ventana muestra el mensaje', () => {
    const spec = alertsPerDaySpec([alert({ fecha_generada: '2026-01-01T00:00:00Z' })], 30, '2026-11-09')
    expect(spec.empty).toMatch(/últimos 30 días/)
  })
})

describe('topFaultsSpec', () => {
  it('cuenta las apariciones por código', () => {
    const spec = topFaultsSpec([faultAlert('P0420'), faultAlert('P0420'), faultAlert('P0101')])
    expect(option(spec).yAxis.data).toEqual(['P0420', 'P0101'])
    expect(spec.table.rows).toEqual([
      ['P0420', '2'],
      ['P0101', '1'],
    ])
  })

  it('escapa los códigos en el tooltip: los informan los dispositivos y no son de confianza', () => {
    const spec = topFaultsSpec([faultAlert('<img src=x onerror=alert(1)>')])
    const html: string = option(spec).tooltip.formatter({ dataIndex: 0 })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
})
