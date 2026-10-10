import { describe, expect, it } from 'vitest'
import {
  ALERTS_PAGE_SIZE,
  DEFAULT_ALERT_FILTERS,
  alertFiltersToQuery,
  alertListQueryKey,
  pageCount,
  parseAlertFilters,
  serializeAlertFilters,
} from '../../../../../src/features/alerts/utils/filters'

const parse = (search: string) => parseAlertFilters(new URLSearchParams(search))

describe('parseAlertFilters', () => {
  it('por defecto muestra las alertas abiertas, de todos los tipos y unidades, en la página 1', () => {
    expect(parse('')).toEqual(DEFAULT_ALERT_FILTERS)
    expect(DEFAULT_ALERT_FILTERS.estado).toBe('abierta')
  })

  it('lee estado, tipo, unidad y página; normaliza la patente a mayúsculas', () => {
    expect(parse('estado=revisada&tipo=falla_nueva&patente=hc176vh&page=3')).toEqual({
      estado: 'revisada',
      tipo: 'falla_nueva',
      patente: 'HC176VH',
      page: 3,
    })
  })

  it('normaliza valores inválidos', () => {
    expect(parse('estado=cerrada&tipo=otra&patente=%3Cscript%3E&page=0')).toEqual(DEFAULT_ALERT_FILTERS)
    expect(parse('page=-2').page).toBe(1)
    expect(parse('page=2.5').page).toBe(1)
    expect(parse('page=abc').page).toBe(1)
  })
})

describe('alertFiltersToQuery', () => {
  it('"todas" no envía el parámetro estado: no es un valor de la API', () => {
    const query = alertFiltersToQuery({ ...DEFAULT_ALERT_FILTERS, estado: 'todas' })
    expect(query.estado).toBeUndefined()
  })

  it('envía estado, tipo y patente cuando están aplicados', () => {
    expect(
      alertFiltersToQuery({ estado: 'revisada', tipo: 'tarea_vencida', patente: 'AB123CD', page: 2 }),
    ).toEqual({ estado: 'revisada', tipo: 'tarea_vencida', patente: 'AB123CD' })
  })
})

describe('serializeAlertFilters', () => {
  it('es el inverso de parse y omite los valores por defecto', () => {
    expect(serializeAlertFilters(DEFAULT_ALERT_FILTERS).toString()).toBe('')
    const filters = { estado: 'todas', tipo: 'dispositivo_sin_reportar', patente: 'AB123CD', page: 2 } as const
    expect(parseAlertFilters(serializeAlertFilters(filters))).toEqual(filters)
  })
})

describe('alertListQueryKey', () => {
  it('distingue estado, tipo, unidad y página', () => {
    const keys = [
      DEFAULT_ALERT_FILTERS,
      { ...DEFAULT_ALERT_FILTERS, estado: 'revisada' as const },
      { ...DEFAULT_ALERT_FILTERS, estado: 'todas' as const },
      { ...DEFAULT_ALERT_FILTERS, tipo: 'falla_nueva' as const },
      { ...DEFAULT_ALERT_FILTERS, patente: 'AB123CD' },
      { ...DEFAULT_ALERT_FILTERS, page: 2 },
    ].map((filters) => JSON.stringify(alertListQueryKey(filters)))

    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('pageCount', () => {
  it('nunca baja de 1 y redondea hacia arriba', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(ALERTS_PAGE_SIZE)).toBe(1)
    expect(pageCount(ALERTS_PAGE_SIZE + 1)).toBe(2)
  })
})
