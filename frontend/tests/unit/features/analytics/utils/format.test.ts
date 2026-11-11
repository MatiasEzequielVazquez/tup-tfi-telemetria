import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  formatDuration,
  formatPercent,
  formatShortDay,
} from '../../../../../src/features/analytics/utils/format'

describe('formatDuration', () => {
  it('elige la unidad que se lee mejor', () => {
    expect(formatDuration(0.25)).toBe('15 min')
    expect(formatDuration(0.001)).toBe('1 min')
    expect(formatDuration(3)).toBe('3 h')
    expect(formatDuration(1.5)).toBe('1,5 h')
    expect(formatDuration(47.9)).toBe('47,9 h')
    expect(formatDuration(72)).toBe('3 d')
  })
})

describe('formatos', () => {
  it('día corto y porcentaje', () => {
    expect(formatShortDay('2026-11-09')).toBe('09/11')
    expect(formatPercent(0.666)).toMatch(/^67\s%$/)
  })
})

describe('escapeHtml', () => {
  it('neutraliza los caracteres de HTML', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;')
    expect(escapeHtml('P0420')).toBe('P0420')
  })
})
