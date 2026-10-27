import { describe, expect, it } from 'vitest'
import { formatKm } from '../../../../src/shared/utils/formatKm'

describe('formatKm', () => {
  it('muestra los kilómetros con separador de miles argentino', () => {
    expect(formatKm(852128)).toBe('852.128 km')
    expect(formatKm(40000)).toBe('40.000 km')
    expect(formatKm(0)).toBe('0 km')
  })

  it('conserva un decimal si lo hay y redondea el resto', () => {
    expect(formatKm(852128.5)).toBe('852.128,5 km')
    expect(formatKm(100.04)).toBe('100 km')
  })
})
