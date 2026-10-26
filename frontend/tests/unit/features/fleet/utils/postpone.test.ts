import { describe, expect, it } from 'vitest'
import {
  buildPostponeBody,
  canPostpone,
  MAX_DESCRIPTION_LENGTH,
  parseMotivo,
  suggestedLimit,
  validatePostpone,
  type PostponeFormValues,
} from '../../../../../src/features/fleet/utils/postpone'

const valid: PostponeFormValues = { motivo: 'salida_urgente', descripcion: '', limite: '419000' }

describe('canPostpone (CU10)', () => {
  it('se ofrece en tareas próximas o vencidas de una unidad activa', () => {
    expect(canPostpone(true, 'proxima')).toBe(true)
    expect(canPostpone(true, 'vencida')).toBe(true)
  })

  it('no se ofrece en tareas al día ni ya postergadas', () => {
    expect(canPostpone(true, 'al_dia')).toBe(false)
    expect(canPostpone(true, 'postergada')).toBe(false)
  })

  it('no se ofrece en una unidad dada de baja', () => {
    expect(canPostpone(false, 'vencida')).toBe(false)
  })
})

describe('parseMotivo', () => {
  it('acepta los motivos del contrato y trata cualquier otro valor como "sin elegir"', () => {
    expect(parseMotivo('falta_espacio')).toBe('falta_espacio')
    expect(parseMotivo('salida_urgente')).toBe('salida_urgente')
    expect(parseMotivo('otro')).toBe('otro')
    expect(parseMotivo('')).toBe('')
    expect(parseMotivo('vacaciones')).toBe('')
  })
})

describe('suggestedLimit', () => {
  it('propone el km actual más una semana de operación', () => {
    expect(suggestedLimit(415000)).toBe(419000)
  })

  it('redondea hacia arriba, porque el contrato pide un entero', () => {
    expect(suggestedLimit(415000.5)).toBe(419001)
  })
})

describe('validatePostpone (RN07)', () => {
  it('acepta un motivo elegido y un límite entero mayor al km actual', () => {
    expect(validatePostpone(valid, 415000)).toEqual({})
  })

  it('exige elegir un motivo', () => {
    expect(validatePostpone({ ...valid, motivo: '' }, 415000).motivo).toMatch(/Elegí un motivo/)
  })

  it('con el motivo "otro" exige la descripción, sin contar espacios', () => {
    const otro = { ...valid, motivo: 'otro' as const }
    expect(validatePostpone({ ...otro, descripcion: '   ' }, 0).descripcion).toMatch(/Describí/)
    expect(validatePostpone({ ...otro, descripcion: 'Esperando repuesto' }, 0).descripcion).toBeUndefined()
  })

  it('con otro motivo la descripción no se exige', () => {
    expect(validatePostpone({ ...valid, motivo: 'falta_espacio', descripcion: '' }, 0)).toEqual({})
  })

  it('limita el largo de la descripción', () => {
    const larga = 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1)
    expect(validatePostpone({ ...valid, motivo: 'otro', descripcion: larga }, 0).descripcion).toMatch(/hasta 255/)
  })

  it('exige un límite entero', () => {
    expect(validatePostpone({ ...valid, limite: '' }, 0).limite).toMatch(/Ingresá el nuevo límite/)
    expect(validatePostpone({ ...valid, limite: 'abc' }, 0).limite).toMatch(/entero/)
    expect(validatePostpone({ ...valid, limite: '419000.5' }, 0).limite).toMatch(/entero/)
  })

  it('rechaza un límite menor o igual al km actual, con el valor actual en el mensaje', () => {
    const message = /mayor al kilometraje actual \(415\.000 km\)/
    expect(validatePostpone({ ...valid, limite: '415000' }, 415000).limite).toMatch(message)
    expect(validatePostpone({ ...valid, limite: '400000' }, 415000).limite).toMatch(message)
    expect(validatePostpone({ ...valid, limite: '415001' }, 415000).limite).toBeUndefined()
  })

  it('informa todos los errores a la vez', () => {
    const errors = validatePostpone({ motivo: '', descripcion: '', limite: '' }, 0)
    expect(Object.keys(errors).sort()).toEqual(['limite', 'motivo'])
  })
})

describe('buildPostponeBody', () => {
  it('envía motivo y límite; la descripción solo con el motivo "otro"', () => {
    expect(buildPostponeBody({ motivo: 'falta_espacio', descripcion: 'ignorada', limite: ' 419000 ' })).toEqual({
      motivo: 'falta_espacio',
      km_limite_nuevo: 419000,
    })
    expect(buildPostponeBody({ motivo: 'otro', descripcion: '  Esperando repuesto ', limite: '419000' })).toEqual({
      motivo: 'otro',
      motivo_descripcion: 'Esperando repuesto',
      km_limite_nuevo: 419000,
    })
  })
})
