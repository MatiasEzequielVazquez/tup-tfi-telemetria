import { describe, expect, it } from 'vitest'
import {
  alertsByType,
  alertsPerDay,
  averageKmByTenure,
  fleetKpis,
  maintenanceCounts,
  shiftDateOnly,
  topFaultCodes,
  topUnitsByKm,
} from '../../../../../src/features/analytics/utils/metrics'
import { alert, unit } from '../fixtures'

describe('fleetKpis', () => {
  it('sin datos no divide por cero', () => {
    const k = fleetKpis([], [])
    expect(k).toMatchObject({ units: 0, kmAverage: 0, openAlerts: 0, meanReviewHours: null, oldestOpenAlert: null })
  })

  it('promedia los km y cuenta unidades con plan, al día, con dispositivo y con fallas', () => {
    const k = fleetKpis(
      [
        unit({ patente: 'A', km_actual: 100 }),
        unit({ patente: 'B', km_actual: 300, estado_mantenimiento: 'vencida', fallas_activas: 2 }),
        unit({ patente: 'C', km_actual: 0, estado_mantenimiento: null, dispositivo: null }),
      ],
      [],
    )
    expect(k.units).toBe(3)
    expect(k.kmTotal).toBe(400)
    expect(k.kmAverage).toBeCloseTo(133.33, 1)
    expect(k.withPlan).toBe(2)
    expect(k.upToDate).toBe(1)
    expect(k.withDevice).toBe(2)
    expect(k.reporting).toBe(2)
    expect(k.unitsWithFaults).toBe(1)
    expect(k.activeFaults).toBe(2)
  })

  it('un dispositivo sin reportar no cuenta como reportando', () => {
    const k = fleetKpis([unit({ dispositivo: { device_uid: 'x', estado: 'sin_reportar', ultima_comunicacion: null } })], [])
    expect(k).toMatchObject({ withDevice: 1, reporting: 0 })
  })

  it('cuenta las alertas abiertas, la más antigua y el tiempo medio de revisión', () => {
    const k = fleetKpis(
      [],
      [
        alert({ fecha_generada: '2026-11-08T00:00:00Z' }),
        alert({ fecha_generada: '2026-11-05T00:00:00Z' }),
        alert({ estado: 'revisada', fecha_generada: '2026-11-01T00:00:00Z', fecha_revisada: '2026-11-01T02:00:00Z' }),
        alert({ estado: 'revisada', fecha_generada: '2026-11-02T00:00:00Z', fecha_revisada: '2026-11-02T04:00:00Z' }),
      ],
    )
    expect(k.openAlerts).toBe(2)
    expect(k.oldestOpenAlert).toBe('2026-11-05T00:00:00Z')
    expect(k.reviewedAlerts).toBe(2)
    expect(k.meanReviewHours).toBe(3)
  })

  it('ignora revisiones con fechas incoherentes (revisada antes de generarse)', () => {
    const k = fleetKpis(
      [],
      [alert({ estado: 'revisada', fecha_generada: '2026-11-02T00:00:00Z', fecha_revisada: '2026-11-01T00:00:00Z' })],
    )
    expect(k.meanReviewHours).toBeNull()
  })
})

describe('maintenanceCounts', () => {
  it('siempre devuelve los cinco estados en orden de gravedad, con ceros incluidos', () => {
    const counts = maintenanceCounts([
      unit({ estado_mantenimiento: 'proxima' }),
      unit({ estado_mantenimiento: null }),
      unit({ estado_mantenimiento: null }),
    ])
    expect(counts).toEqual([
      { key: 'vencida', count: 0 },
      { key: 'proxima', count: 1 },
      { key: 'postergada', count: 0 },
      { key: 'al_dia', count: 0 },
      { key: 'sin_plan', count: 2 },
    ])
  })
})

describe('averageKmByTenure', () => {
  it('promedia por tenencia y deja sin dato la que no tiene unidades', () => {
    const rows = averageKmByTenure([unit({ km_actual: 100 }), unit({ km_actual: 300 })])
    expect(rows).toEqual([
      { key: 'propia', units: 2, averageKm: 200 },
      { key: 'fletero', units: 0, averageKm: null },
    ])
  })
})

describe('topUnitsByKm', () => {
  it('ordena de mayor a menor, desempata por patente y respeta el límite', () => {
    const units = [unit({ patente: 'C', km_actual: 5 }), unit({ patente: 'B', km_actual: 9 }), unit({ patente: 'A', km_actual: 9 })]
    expect(topUnitsByKm(units, 2)).toEqual([
      { patente: 'A', km: 9 },
      { patente: 'B', km: 9 },
    ])
  })

  it('no modifica la lista recibida', () => {
    const units = [unit({ patente: 'B', km_actual: 1 }), unit({ patente: 'A', km_actual: 2 })]
    topUnitsByKm(units)
    expect(units.map((u) => u.patente)).toEqual(['B', 'A'])
  })
})

describe('alertsByType', () => {
  it('separa abiertas y revisadas por tipo', () => {
    const rows = alertsByType([
      alert({ tipo: 'tarea_vencida' }),
      alert({ tipo: 'tarea_vencida', estado: 'revisada', fecha_revisada: '2026-11-09T13:00:00Z' }),
      alert({ tipo: 'falla_nueva', origen: 'falla' }),
    ])
    expect(rows.find((r) => r.key === 'tarea_vencida')).toEqual({ key: 'tarea_vencida', open: 1, reviewed: 1 })
    expect(rows.find((r) => r.key === 'falla_nueva')).toEqual({ key: 'falla_nueva', open: 1, reviewed: 0 })
    expect(rows.find((r) => r.key === 'dispositivo_sin_reportar')).toEqual({
      key: 'dispositivo_sin_reportar',
      open: 0,
      reviewed: 0,
    })
  })
})

describe('shiftDateOnly', () => {
  it('suma y resta días atravesando meses, años y bisiestos', () => {
    expect(shiftDateOnly('2026-11-09', -9)).toBe('2026-10-31')
    expect(shiftDateOnly('2026-01-02', -3)).toBe('2025-12-30')
    expect(shiftDateOnly('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDateOnly('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('alertsPerDay', () => {
  it('devuelve exactamente `days` días hasta hoy, con ceros, y cuenta por día de Buenos Aires', () => {
    const perDay = alertsPerDay(
      [
        alert({ fecha_generada: '2026-11-09T15:00:00Z' }),
        alert({ fecha_generada: '2026-11-09T20:00:00Z' }),
        // 01:30 UTC del 9 son las 22:30 del 8 en Buenos Aires
        alert({ fecha_generada: '2026-11-09T01:30:00Z' }),
        alert({ fecha_generada: '2026-10-01T12:00:00Z' }), // fuera de la ventana
      ],
      7,
      '2026-11-09',
    )
    expect(perDay).toHaveLength(7)
    expect(perDay[0].date).toBe('2026-11-03')
    expect(perDay[6]).toEqual({ date: '2026-11-09', count: 2 })
    expect(perDay[5]).toEqual({ date: '2026-11-08', count: 1 })
    expect(perDay.reduce((s, d) => s + d.count, 0)).toBe(3)
  })

  it('ignora fechas inválidas', () => {
    const perDay = alertsPerDay([alert({ fecha_generada: 'no es fecha' })], 3, '2026-11-09')
    expect(perDay.every((d) => d.count === 0)).toBe(true)
  })
})

describe('topFaultCodes', () => {
  it('cuenta apariciones por código solo de alertas de falla, ordenadas y limitadas', () => {
    const f = (codigo: string) => alert({ origen: 'falla', tipo: 'falla_nueva', referencia: codigo })
    const top = topFaultCodes([f('P0420'), f('P0101'), f('P0420'), f('SPN-110-FMI-0'), alert({ referencia: 'ACEITE_MOTOR' })], 2)
    expect(top).toEqual([
      { code: 'P0420', count: 2 },
      { code: 'P0101', count: 1 },
    ])
  })
})
