import { describe, expect, it } from 'vitest'
import type { Plan } from '../../../../../src/features/fleet/types'
import {
  buildServiceBody,
  canRegisterService,
  initialServiceValues,
  MAX_OBSERVATIONS_LENGTH,
  sortPlansByUrgency,
  toggleTask,
  validateService,
  type ServiceFormValues,
} from '../../../../../src/features/fleet/utils/service'

const TODAY = '2026-10-07'
const plan = (codigo_tarea: string, estado: Plan['estado']) => ({ codigo_tarea, estado }) as Plan
const valid: ServiceFormValues = { fecha: TODAY, km: '415200', observaciones: '', tareas: ['ACEITE_MOTOR'] }

describe('sortPlansByUrgency', () => {
  it('ordena de la tarea más urgente a la menos, sin tocar el original', () => {
    const planes = [plan('A', 'al_dia'), plan('B', 'postergada'), plan('C', 'proxima'), plan('D', 'vencida')]

    expect(sortPlansByUrgency(planes).map((p) => p.codigo_tarea)).toEqual(['D', 'C', 'B', 'A'])
    expect(planes.map((p) => p.codigo_tarea)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('conserva el orden de la API entre tareas del mismo estado', () => {
    const planes = [plan('X', 'proxima'), plan('Y', 'proxima'), plan('Z', 'proxima')]
    expect(sortPlansByUrgency(planes).map((p) => p.codigo_tarea)).toEqual(['X', 'Y', 'Z'])
  })
})

describe('canRegisterService', () => {
  it('se ofrece en una unidad activa con tareas en su plan', () => {
    expect(canRegisterService(true, [plan('A', 'al_dia')])).toBe(true)
  })

  it('no se ofrece sin tareas en el plan ni en una unidad dada de baja', () => {
    expect(canRegisterService(true, [])).toBe(false)
    expect(canRegisterService(false, [plan('A', 'vencida')])).toBe(false)
  })
})

describe('initialServiceValues', () => {
  it('propone la fecha de hoy y el km actual, sin tareas marcadas', () => {
    expect(initialServiceValues(415000.5, TODAY)).toEqual({
      fecha: TODAY,
      km: '415000.5',
      observaciones: '',
      tareas: [],
    })
  })
})

describe('toggleTask', () => {
  it('marca y desmarca una tarea, conservando el orden en que se marcaron', () => {
    const una = toggleTask([], 'B')
    const dos = toggleTask(una, 'A')

    expect(dos).toEqual(['B', 'A'])
    expect(toggleTask(dos, 'B')).toEqual(['A'])
  })
})

describe('validateService (CU09)', () => {
  it('acepta fecha de hoy, km y al menos una tarea', () => {
    expect(validateService(valid, TODAY)).toEqual({})
  })

  it('acepta un km menor al actual: el service pudo hacerse antes', () => {
    expect(validateService({ ...valid, km: '100', fecha: '2026-09-01' }, TODAY)).toEqual({})
  })

  it('no permite guardar sin tareas', () => {
    expect(validateService({ ...valid, tareas: [] }, TODAY).tareas).toMatch(/al menos una tarea/)
  })

  it('exige el km y que sea un número no negativo', () => {
    expect(validateService({ ...valid, km: '' }, TODAY).km).toMatch(/Ingresá el kilometraje/)
    expect(validateService({ ...valid, km: 'abc' }, TODAY).km).toMatch(/número/)
    expect(validateService({ ...valid, km: '-1' }, TODAY).km).toMatch(/número/)
  })

  it('exige una fecha y rechaza las futuras', () => {
    expect(validateService({ ...valid, fecha: '' }, TODAY).fecha).toMatch(/Ingresá la fecha/)
    expect(validateService({ ...valid, fecha: '2026-10-08' }, TODAY).fecha).toMatch(/futura/)
  })

  it('limita el largo de las observaciones, sin contar espacios sobrantes', () => {
    const larga = 'x'.repeat(MAX_OBSERVATIONS_LENGTH + 1)
    expect(validateService({ ...valid, observaciones: larga }, TODAY).observaciones).toMatch(/hasta 2000/)
    expect(validateService({ ...valid, observaciones: `  ${'x'.repeat(MAX_OBSERVATIONS_LENGTH)}  ` }, TODAY)).toEqual({})
  })

  it('informa todos los errores a la vez', () => {
    const errors = validateService({ fecha: '', km: '', observaciones: '', tareas: [] }, TODAY)
    expect(Object.keys(errors).sort()).toEqual(['fecha', 'km', 'tareas'])
  })
})

describe('buildServiceBody', () => {
  it('omite la fecha si es hoy y las observaciones si están vacías', () => {
    expect(buildServiceBody({ ...valid, km: ' 415200 ', observaciones: '   ' }, TODAY)).toEqual({
      km: 415200,
      tareas: ['ACEITE_MOTOR'],
    })
  })

  it('envía la fecha si es otro día y las observaciones sin espacios sobrantes', () => {
    const values = {
      fecha: '2026-10-01',
      km: '415200.5',
      observaciones: '  Sin novedades  ',
      tareas: ['ACEITE_MOTOR', 'SECADOR_AIRE'],
    }

    expect(buildServiceBody(values, TODAY)).toEqual({
      fecha: '2026-10-01',
      km: 415200.5,
      observaciones: 'Sin novedades',
      tareas: ['ACEITE_MOTOR', 'SECADOR_AIRE'],
    })
  })

  it('no comparte el arreglo de tareas con el formulario', () => {
    const body = buildServiceBody(valid, TODAY)
    expect(body.tareas).not.toBe(valid.tareas)
  })
})
