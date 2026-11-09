import { describe, expect, it } from 'vitest'
import { readChartColors } from '../../../../src/shared/utils/chartColors'

const style = (vars: Record<string, string>) => ({ getPropertyValue: (name: string) => vars[name] ?? '' })

describe('readChartColors', () => {
  it('lee las variables CSS del tema, sin espacios sobrantes', () => {
    const colors = readChartColors(style({ '--fg': ' #e8ecf1 ', '--chart-series': '#3987e5', '--surface': '#1b212a' }))
    expect(colors.text).toBe('#e8ecf1')
    expect(colors.series).toBe('#3987e5')
    expect(colors.surface).toBe('#1b212a')
  })

  it('si falta una variable usa el valor del tema claro', () => {
    const colors = readChartColors(style({}))
    expect(colors.series).toBe('#2a78d6')
    expect(colors.danger).toBe('#d03b3b')
  })
})
