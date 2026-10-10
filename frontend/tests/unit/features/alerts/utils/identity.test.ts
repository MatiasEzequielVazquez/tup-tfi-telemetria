import { describe, expect, it } from 'vitest'
import type { Alerta } from '../../../../../src/features/alerts/types'
import { alertKey, buildReviewBody } from '../../../../../src/features/alerts/utils/identity'

const base = {
  patente: 'HC176VH',
  referencia: 'ACEITE_MOTOR',
  referencia_nombre: 'Cambio de aceite de motor',
  fecha_generada: '2026-10-05T09:00:00Z',
  fecha_revisada: null,
  estado: 'abierta',
} as const

const plan: Alerta = {
  ...base,
  origen: 'plan',
  tipo: 'tarea_vencida',
  clave: {
    patente: 'HC176VH',
    codigo_tarea: 'ACEITE_MOTOR',
    tipo: 'tarea_vencida',
    fecha_generada: '2026-10-05T09:00:00Z',
  },
}

const falla: Alerta = {
  ...base,
  origen: 'falla',
  tipo: 'falla_nueva',
  referencia: 'SPN-100-FMI-3',
  referencia_nombre: null,
  clave: { patente: 'HC176VH', codigo: 'SPN-100-FMI-3', fecha_aparicion: '2026-10-05T07:00:00Z' },
}

const dispositivo: Alerta = {
  ...base,
  origen: 'dispositivo',
  tipo: 'dispositivo_sin_reportar',
  referencia: 'esp32-1AA63D',
  referencia_nombre: null,
  clave: { device_uid: 'esp32-1AA63D', fecha_generada: '2026-10-03T12:00:00Z' },
}

describe('buildReviewBody', () => {
  it('plan: origen + clave exacta del contrato', () => {
    expect(buildReviewBody(plan)).toEqual({
      origen: 'plan',
      patente: 'HC176VH',
      codigo_tarea: 'ACEITE_MOTOR',
      tipo: 'tarea_vencida',
      fecha_generada: '2026-10-05T09:00:00Z',
    })
  })

  it('falla: usa la fecha de aparición, no la de generación', () => {
    expect(buildReviewBody(falla)).toEqual({
      origen: 'falla',
      patente: 'HC176VH',
      codigo: 'SPN-100-FMI-3',
      fecha_aparicion: '2026-10-05T07:00:00Z',
    })
  })

  it('dispositivo: device_uid y fecha generada, sin patente', () => {
    expect(buildReviewBody(dispositivo)).toEqual({
      origen: 'dispositivo',
      device_uid: 'esp32-1AA63D',
      fecha_generada: '2026-10-03T12:00:00Z',
    })
  })

  it('no inventa campos: si falta alguno de la clave, no arma el cuerpo', () => {
    const incompleta: Alerta = { ...plan, clave: { patente: 'HC176VH', codigo_tarea: 'ACEITE_MOTOR' } }
    expect(() => buildReviewBody(incompleta)).toThrowError(/tipo, fecha_generada/)
  })
})

describe('alertKey', () => {
  it('es estable: no depende del orden de los campos de la clave', () => {
    const reordenada: Alerta = {
      ...plan,
      clave: {
        fecha_generada: '2026-10-05T09:00:00Z',
        tipo: 'tarea_vencida',
        codigo_tarea: 'ACEITE_MOTOR',
        patente: 'HC176VH',
      },
    }
    expect(alertKey(reordenada)).toBe(alertKey(plan))
  })

  it('distingue alertas del mismo origen con distinta clave, y orígenes distintos', () => {
    const otraFecha: Alerta = {
      ...plan,
      clave: { ...plan.clave, fecha_generada: '2026-10-06T09:00:00Z' },
    }
    const keys = [alertKey(plan), alertKey(otraFecha), alertKey(falla), alertKey(dispositivo)]
    expect(new Set(keys).size).toBe(4)
  })
})
