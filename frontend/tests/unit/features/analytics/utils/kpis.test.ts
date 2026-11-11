import { describe, expect, it } from 'vitest'
import { buildKpis } from '../../../../../src/features/analytics/utils/kpis'
import { fleetKpis } from '../../../../../src/features/analytics/utils/metrics'
import { alert, unit } from '../fixtures'

const byId = (kpis: ReturnType<typeof buildKpis>) => Object.fromEntries(kpis.map((k) => [k.id, k]))

describe('buildKpis', () => {
  it('con una flota vacía muestra guiones y no inventa porcentajes', () => {
    const k = byId(buildKpis(fleetKpis([], [])))
    expect(k['km-average'].value).toBe('–')
    expect(k['up-to-date'].value).toBe('–')
    expect(k['review-time'].value).toBe('–')
    expect(k['open-alerts'].hint).toBe('Ninguna pendiente de revisión')
  })

  it('arma los textos con los datos', () => {
    const now = new Date('2026-11-09T12:00:00Z')
    const k = byId(
      buildKpis(
        fleetKpis(
          [
            unit({ km_actual: 1000 }),
            unit({ patente: 'B', km_actual: 3000, estado_mantenimiento: 'vencida', fallas_activas: 1 }),
          ],
          [alert({ fecha_generada: '2026-11-09T09:00:00Z' })],
        ),
        now,
      ),
    )
    expect(k.units.value).toBe('2')
    expect(k['km-average'].value).toBe('2.000 km')
    expect(k['km-average'].hint).toBe('Total de la flota: 4.000 km')
    expect(k['up-to-date'].value).toMatch(/^50\s%$/)
    expect(k['up-to-date'].hint).toBe('1 de 2 unidades con plan')
    expect(k['open-alerts'].value).toBe('1')
    expect(k['open-alerts'].hint).toBe('La más antigua, hace 3 h')
    expect(k.faults.value).toBe('1')
    expect(k.faults.hint).toBe('1 falla activa en total')
  })
})
