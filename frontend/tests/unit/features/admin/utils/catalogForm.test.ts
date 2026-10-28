import { describe, expect, it } from 'vitest'
import type { CatalogTask } from '../../../../../src/features/admin/types'
import {
  buildCatalogBody,
  buildEditCatalogBody,
  catalogTaskToValues,
  DEFAULT_WARNING_KM,
  emptyCatalogValues,
  hasCatalogChanges,
  MAX_NOMBRE,
  normalizeCodigo,
  validateCatalogTask,
  type CatalogFormValues,
} from '../../../../../src/features/admin/utils/catalogForm'
import { parsePositiveInteger } from '../../../../../src/features/admin/utils/numbers'

const valid: CatalogFormValues = {
  codigo: 'FILTRO_AIRE',
  nombre: 'Filtro de aire',
  intervalo: '80000',
  umbral: '4000',
}

describe('parsePositiveInteger', () => {
  it('acepta enteros positivos, con espacios alrededor', () => {
    expect(parsePositiveInteger('80000')).toBe(80000)
    expect(parsePositiveInteger(' 1 ')).toBe(1)
  })

  it('rechaza vacío, cero, negativos, decimales y texto', () => {
    for (const value of ['', '  ', '0', '-5', '1.5', 'abc', '1e3x']) {
      expect(parsePositiveInteger(value)).toBeNull()
    }
  })
})

describe('normalizeCodigo', () => {
  it('pasa a mayúsculas y cambia los espacios por guion bajo', () => {
    expect(normalizeCodigo(' filtro aire ')).toBe('FILTRO_AIRE')
    expect(normalizeCodigo('aceite  caja')).toBe('ACEITE_CAJA')
  })
})

describe('emptyCatalogValues', () => {
  it('propone el aviso de 4.000 km (RN05) y deja lo demás vacío', () => {
    expect(emptyCatalogValues()).toEqual({ codigo: '', nombre: '', intervalo: '', umbral: String(DEFAULT_WARNING_KM) })
    expect(DEFAULT_WARNING_KM).toBe(4000)
  })
})

describe('validateCatalogTask', () => {
  it('acepta una tarea completa', () => {
    expect(validateCatalogTask(valid)).toEqual({})
  })

  it('valida el código después de normalizarlo', () => {
    expect(validateCatalogTask({ ...valid, codigo: 'filtro aire' })).toEqual({})
    expect(validateCatalogTask({ ...valid, codigo: '' }).codigo).toMatch(/Ingresá el código/)
    expect(validateCatalogTask({ ...valid, codigo: 'A' }).codigo).toMatch(/2 a 20/)
    expect(validateCatalogTask({ ...valid, codigo: 'A'.repeat(21) }).codigo).toMatch(/2 a 20/)
    expect(validateCatalogTask({ ...valid, codigo: 'FILTRO-AIRE' }).codigo).toMatch(/2 a 20/)
  })

  it('exige el nombre y limita su largo', () => {
    expect(validateCatalogTask({ ...valid, nombre: '  ' }).nombre).toMatch(/Ingresá el nombre/)
    expect(validateCatalogTask({ ...valid, nombre: 'x'.repeat(MAX_NOMBRE + 1) }).nombre).toMatch(/hasta 100/)
  })

  it('exige el intervalo y el umbral como enteros positivos', () => {
    expect(validateCatalogTask({ ...valid, intervalo: '' }).intervalo).toBeDefined()
    expect(validateCatalogTask({ ...valid, intervalo: '0' }).intervalo).toBeDefined()
    expect(validateCatalogTask({ ...valid, umbral: '1.5' }).umbral).toBeDefined()
    expect(validateCatalogTask({ ...valid, umbral: '-1' }).umbral).toBeDefined()
  })

  it('informa todo lo que falta a la vez', () => {
    expect(Object.keys(validateCatalogTask({ codigo: '', nombre: '', intervalo: '', umbral: '' })).sort()).toEqual([
      'codigo',
      'intervalo',
      'nombre',
      'umbral',
    ])
  })
})

describe('buildCatalogBody', () => {
  it('envía el código normalizado y los números ya convertidos', () => {
    expect(buildCatalogBody({ codigo: ' filtro aire ', nombre: ' Filtro de aire ', intervalo: ' 80000', umbral: '4000' })).toEqual({
      codigo: 'FILTRO_AIRE',
      nombre: 'Filtro de aire',
      intervalo_km_default: 80000,
      umbral_aviso_km_default: 4000,
    })
  })
})

const original: CatalogTask = {
  codigo: 'FILTRO_AIRE',
  nombre: 'Filtro de aire',
  intervalo_km_default: 80000,
  umbral_aviso_km_default: 4000,
  activa: true,
}

describe('catalogTaskToValues', () => {
  it('pasa la tarea a los textos del formulario', () => {
    expect(catalogTaskToValues(original)).toEqual(valid)
  })
})

describe('validateCatalogTask (edición)', () => {
  it('no valida el código, que no se puede cambiar', () => {
    expect(validateCatalogTask({ ...valid, codigo: '' }, { editing: true })).toEqual({})
    expect(validateCatalogTask({ ...valid, codigo: '' }, { editing: false })).toHaveProperty('codigo')
  })

  it('sigue exigiendo nombre y valores válidos', () => {
    expect(Object.keys(validateCatalogTask({ ...valid, nombre: ' ', intervalo: '0' }, { editing: true })).sort()).toEqual([
      'intervalo',
      'nombre',
    ])
  })
})

describe('buildEditCatalogBody', () => {
  it('envía solo lo que cambió', () => {
    expect(buildEditCatalogBody({ ...valid, intervalo: '90000' }, original)).toEqual({ intervalo_km_default: 90000 })
    expect(buildEditCatalogBody({ ...valid, nombre: ' Filtro de aire grande ', umbral: '5000' }, original)).toEqual({
      nombre: 'Filtro de aire grande',
      umbral_aviso_km_default: 5000,
    })
  })

  it('sin cambios no envía nada, y lo avisa hasCatalogChanges', () => {
    const body = buildEditCatalogBody({ ...valid, nombre: ' Filtro de aire ' }, original)

    expect(body).toEqual({})
    expect(hasCatalogChanges(body)).toBe(false)
    expect(hasCatalogChanges({ activa: false })).toBe(true)
  })
})
