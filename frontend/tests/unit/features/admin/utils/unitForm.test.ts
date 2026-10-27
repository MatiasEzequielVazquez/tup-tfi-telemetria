import { describe, expect, it } from 'vitest'
import type { AdminUnit } from '../../../../../src/features/admin/types'
import {
  buildCreateBody,
  buildEditBody,
  emptyUnitValues,
  hasChanges,
  normalizePatente,
  parseProtocolo,
  parseTenencia,
  unitToValues,
  validateUnit,
  type UnitFormValues,
} from '../../../../../src/features/admin/utils/unitForm'

const YEAR = 2026

const valid: UnitFormValues = {
  patente: 'AB123CD',
  marca: 'Scania',
  modelo: 'R 450',
  anio: '2021',
  tenencia: 'fletero',
  titular: 'Hugo Benítez',
  protocolo: 'J1939',
}

const original = {
  patente: 'AB123CD',
  marca: 'Scania',
  modelo: 'R 450',
  anio: 2021,
  tenencia: 'fletero',
  titular: 'Hugo Benítez',
  protocolo: 'J1939',
  activa: true,
} as AdminUnit

const create = (values: UnitFormValues) => validateUnit(values, { editing: false, currentYear: YEAR })
const edit = (values: UnitFormValues, unit = original) =>
  validateUnit(values, { editing: true, original: unit, currentYear: YEAR })

describe('normalizePatente', () => {
  it('pasa a mayúsculas y saca los espacios, como el servidor', () => {
    expect(normalizePatente(' ab 123 cd ')).toBe('AB123CD')
  })
})

describe('parseTenencia y parseProtocolo', () => {
  it('aceptan los valores del contrato y tratan cualquier otro como "sin elegir"', () => {
    expect(parseTenencia('propia')).toBe('propia')
    expect(parseTenencia('fletero')).toBe('fletero')
    expect(parseTenencia('alquilada')).toBe('')
    expect(parseProtocolo('J1939')).toBe('J1939')
    expect(parseProtocolo('J1979')).toBe('J1979')
    expect(parseProtocolo('CAN')).toBe('')
  })
})

describe('validateUnit (alta)', () => {
  it('acepta una unidad completa', () => {
    expect(create(valid)).toEqual({})
  })

  it('acepta solo lo obligatorio: patente, marca, tenencia y protocolo', () => {
    expect(create({ ...emptyUnitValues(), patente: 'AB123CD', marca: 'Iveco', tenencia: 'propia', protocolo: 'J1979' })).toEqual({})
  })

  it('informa todo lo obligatorio que falta', () => {
    expect(Object.keys(create(emptyUnitValues())).sort()).toEqual(['marca', 'patente', 'protocolo', 'tenencia'])
  })

  it('valida el formato de la patente después de normalizarla', () => {
    expect(create({ ...valid, patente: 'ab 123 cd' })).toEqual({})
    expect(create({ ...valid, patente: 'AB1' }).patente).toMatch(/6 a 10/)
    expect(create({ ...valid, patente: 'AB-123-CD' }).patente).toMatch(/6 a 10/)
    expect(create({ ...valid, patente: 'A'.repeat(11) }).patente).toMatch(/6 a 10/)
  })

  it('valida el año: entero entre 1950 y el año que viene', () => {
    expect(create({ ...valid, anio: '1949' }).anio).toMatch(/entre 1950 y 2027/)
    expect(create({ ...valid, anio: '2027' }).anio).toBeUndefined()
    expect(create({ ...valid, anio: '2028' }).anio).toBeDefined()
    expect(create({ ...valid, anio: '2020.5' }).anio).toBeDefined()
    expect(create({ ...valid, anio: 'abc' }).anio).toBeDefined()
    expect(create({ ...valid, anio: '' }).anio).toBeUndefined()
  })

  it('limita el largo de la marca, el modelo y el titular', () => {
    expect(create({ ...valid, marca: 'x'.repeat(51) }).marca).toMatch(/hasta 50/)
    expect(create({ ...valid, modelo: 'x'.repeat(51) }).modelo).toMatch(/hasta 50/)
    expect(create({ ...valid, titular: 'x'.repeat(101) }).titular).toMatch(/hasta 100/)
  })
})

describe('validateUnit (edición)', () => {
  it('no pide la patente: no se puede cambiar', () => {
    expect(edit({ ...valid, patente: '' })).toEqual({})
  })

  it('no deja vacío un año ya cargado, porque el contrato no permite borrarlo', () => {
    expect(edit({ ...valid, anio: '' }).anio).toMatch(/no dejar vacío/)
    expect(edit({ ...valid, anio: '' }, { ...original, anio: null })).toEqual({})
  })
})

describe('buildCreateBody', () => {
  it('envía la patente normalizada y omite lo opcional vacío', () => {
    const body = buildCreateBody({
      ...emptyUnitValues(),
      patente: ' ab 123 cd',
      marca: ' Iveco ',
      tenencia: 'propia',
      protocolo: 'J1979',
    })

    expect(body).toEqual({ patente: 'AB123CD', marca: 'Iveco', tenencia: 'propia', protocolo: 'J1979' })
  })

  it('envía modelo, año y titular cuando están', () => {
    expect(buildCreateBody(valid)).toEqual({
      patente: 'AB123CD',
      marca: 'Scania',
      modelo: 'R 450',
      anio: 2021,
      tenencia: 'fletero',
      titular: 'Hugo Benítez',
      protocolo: 'J1939',
    })
  })

  it('no envía el titular de una unidad propia', () => {
    const body = buildCreateBody({ ...valid, tenencia: 'propia', titular: 'Dato viejo' })
    expect(body).not.toHaveProperty('titular')
  })
})

describe('buildEditBody', () => {
  it('sin cambios, no hay nada para guardar', () => {
    expect(buildEditBody(unitToValues(original), original)).toEqual({})
    expect(hasChanges({})).toBe(false)
  })

  it('envía solo lo que cambió', () => {
    const body = buildEditBody({ ...unitToValues(original), marca: ' Volvo ', anio: '2022' }, original)

    expect(body).toEqual({ marca: 'Volvo', anio: 2022 })
    expect(hasChanges(body)).toBe(true)
  })

  it('vaciar el modelo envía un texto vacío', () => {
    expect(buildEditBody({ ...unitToValues(original), modelo: '' }, original)).toEqual({ modelo: '' })
  })

  it('al pasar a propia, limpia el titular que tenía', () => {
    const body = buildEditBody({ ...unitToValues(original), tenencia: 'propia' }, original)
    expect(body).toEqual({ tenencia: 'propia', titular: '' })
  })

  it('una unidad sin modelo ni titular y sin cambios no envía campos vacíos', () => {
    const sinDatos = { ...original, modelo: null, titular: null, tenencia: 'propia' } as AdminUnit
    expect(buildEditBody(unitToValues(sinDatos), sinDatos)).toEqual({})
  })
})

describe('unitToValues', () => {
  it('convierte los nulos en textos vacíos para los campos del formulario', () => {
    expect(unitToValues({ ...original, modelo: null, anio: null, titular: null } as AdminUnit)).toMatchObject({
      modelo: '',
      anio: '',
      titular: '',
    })
  })
})
