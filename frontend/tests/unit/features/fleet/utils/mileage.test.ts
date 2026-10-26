import { describe, expect, it } from 'vitest'
import {
  buildMileageBody,
  canLoadMileage,
  validateMileage,
} from '../../../../../src/features/fleet/utils/mileage'

const TODAY = '2026-10-07'
const dispositivo = (estado: 'activo' | 'inactivo' | 'sin_reportar') => ({
  device_uid: 'esp32-0F3A21',
  estado,
  ultima_comunicacion: null,
  desde: '2026-01-01T00:00:00Z',
})

describe('canLoadMileage (RF06)', () => {
  it('se ofrece si la unidad no tiene dispositivo o lo tiene fuera de servicio', () => {
    expect(canLoadMileage(true, null)).toBe(true)
    expect(canLoadMileage(true, dispositivo('sin_reportar'))).toBe(true)
    expect(canLoadMileage(true, dispositivo('inactivo'))).toBe(true)
  })

  it('no se ofrece con un dispositivo activo, que informa el kilometraje por su cuenta', () => {
    expect(canLoadMileage(true, dispositivo('activo'))).toBe(false)
  })

  it('no se ofrece en una unidad dada de baja', () => {
    expect(canLoadMileage(false, null)).toBe(false)
  })
})

describe('validateMileage', () => {
  const valid = { km: '415200', fecha: TODAY }

  it('acepta un kilometraje igual o mayor al actual, con decimales, y la fecha de hoy', () => {
    expect(validateMileage(valid, 415000, TODAY)).toEqual({})
    expect(validateMileage({ km: '415000', fecha: TODAY }, 415000, TODAY)).toEqual({})
    expect(validateMileage({ km: '415000.5', fecha: '2026-10-01' }, 415000, TODAY)).toEqual({})
  })

  it('exige el kilometraje y que sea un número no negativo', () => {
    expect(validateMileage({ ...valid, km: '' }, 0, TODAY).km).toMatch(/Ingresá el kilometraje/)
    expect(validateMileage({ ...valid, km: '   ' }, 0, TODAY).km).toMatch(/Ingresá el kilometraje/)
    expect(validateMileage({ ...valid, km: 'abc' }, 0, TODAY).km).toMatch(/número/)
    expect(validateMileage({ ...valid, km: '-5' }, 0, TODAY).km).toMatch(/número/)
  })

  it('avisa que el kilometraje no puede disminuir (RN09), con el valor actual', () => {
    expect(validateMileage({ ...valid, km: '414999' }, 415000, TODAY).km).toMatch(
      /menor al kilometraje actual \(415\.000 km\)/,
    )
  })

  it('exige una fecha y rechaza las futuras', () => {
    expect(validateMileage({ ...valid, fecha: '' }, 0, TODAY).fecha).toMatch(/Ingresá la fecha/)
    expect(validateMileage({ ...valid, fecha: '2026-10-08' }, 0, TODAY).fecha).toMatch(/futura/)
  })

  it('informa todos los errores a la vez', () => {
    expect(Object.keys(validateMileage({ km: '', fecha: '' }, 0, TODAY)).sort()).toEqual(['fecha', 'km'])
  })
})

describe('buildMileageBody', () => {
  it('omite la fecha si es hoy: el servidor usa el instante actual', () => {
    expect(buildMileageBody({ km: ' 415200 ', fecha: TODAY }, TODAY)).toEqual({ km: 415200 })
  })

  it('envía una fecha pasada a mediodía de Argentina, para que el día no se corra', () => {
    const body = buildMileageBody({ km: '415200.5', fecha: '2026-10-01' }, TODAY)

    expect(body).toEqual({ km: 415200.5, fecha: '2026-10-01T12:00:00-03:00' })
    expect(new Date(body.fecha!).toISOString()).toBe('2026-10-01T15:00:00.000Z')
  })
})
