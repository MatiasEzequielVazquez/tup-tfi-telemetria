import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  todayDateOnly,
} from '../../../../src/shared/utils/formatDate'

describe('todayDateOnly', () => {
  it('da el día en Buenos Aires, no el UTC', () => {
    // 02:00 UTC del 8 de octubre son las 23:00 del 7 en Buenos Aires.
    expect(todayDateOnly(new Date('2026-10-08T02:00:00Z'))).toBe('2026-10-07')
    expect(todayDateOnly(new Date('2026-10-08T03:00:00Z'))).toBe('2026-10-08')
  })
})

// Los nombres de mes abreviados dependen de los datos de ICU del entorno ("oct" u "oct."),
// así que se compara con una expresión que admite ambos.
const OCT_7_2026 = /^7 oct\.? 2026$/

describe('formatDateOnly', () => {
  it('muestra el mismo día de calendario, sin correrlo por la zona horaria', () => {
    expect(formatDateOnly('2026-10-07')).toMatch(OCT_7_2026)
  })

  it('a diferencia de formatDate, que toma el valor como un instante UTC', () => {
    // Medianoche UTC del 7 es el 6 a las 21:00 en Buenos Aires: por eso hace falta formatDateOnly.
    expect(formatDate('2026-10-07')).toMatch(/^6 oct\.? 2026$/)
  })

  it('devuelve el valor tal cual si no es una fecha válida', () => {
    for (const value of ['2026-02-30', '2026-10-07T12:00:00Z', '07/10/2026', '']) {
      expect(formatDateOnly(value)).toBe(value)
    }
  })
})

describe('formatDate y formatDateTime', () => {
  it('muestran el instante en hora de Buenos Aires', () => {
    expect(formatDate('2026-10-07T02:00:00Z')).toMatch(/^6 oct\.? 2026$/)
    expect(formatDateTime('2026-10-07T15:30:00Z')).toMatch(/^7 oct\.? 2026,? 12:30/)
  })

  it('devuelven el texto original si no se puede interpretar', () => {
    expect(formatDate('no es fecha')).toBe('no es fecha')
    expect(formatDateTime('no es fecha')).toBe('no es fecha')
  })
})
