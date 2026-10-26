import { describe, expect, it } from 'vitest'
import {
  applyHistoryPatch,
  DEFAULT_HISTORY_FILTERS,
  HISTORY_PAGE_SIZE,
  historyFiltersToQuery,
  historyQueryKey,
  historyRangeError,
  pageCount,
  parseHistoryFilters,
  serializeHistoryFilters,
  type HistoryFilters,
} from '../../../../../src/features/fleet/utils/history'

const parse = (query: string) => parseHistoryFilters(new URLSearchParams(query))
const filters = (patch: Partial<HistoryFilters> = {}): HistoryFilters => ({ ...DEFAULT_HISTORY_FILTERS, ...patch })

describe('parseHistoryFilters', () => {
  it('sin parámetros, usa los valores por defecto', () => {
    expect(parse('')).toEqual(DEFAULT_HISTORY_FILTERS)
  })

  it('lee el período y las dos páginas', () => {
    expect(parse('desde=2026-01-01&hasta=2026-06-30&services_page=2&postergaciones_page=3')).toEqual({
      desde: '2026-01-01',
      hasta: '2026-06-30',
      servicesPage: 2,
      postponementsPage: 3,
    })
  })

  it('descarta fechas que no existen o con otro formato, y páginas inválidas', () => {
    expect(parse('desde=2026-02-30&hasta=ayer&services_page=0&postergaciones_page=abc')).toEqual(
      DEFAULT_HISTORY_FILTERS,
    )
    expect(parse('services_page=1.5&postergaciones_page=-2').servicesPage).toBe(1)
  })
})

describe('serializeHistoryFilters', () => {
  it('escribe solo lo que no tiene el valor por defecto', () => {
    expect(serializeHistoryFilters(DEFAULT_HISTORY_FILTERS).toString()).toBe('')
    expect(serializeHistoryFilters(filters({ desde: '2026-01-01', servicesPage: 2 })).toString()).toBe(
      'desde=2026-01-01&services_page=2',
    )
  })

  it('ida y vuelta: lo que se escribe se vuelve a leer igual', () => {
    const original = filters({ desde: '2026-01-01', hasta: '2026-06-30', servicesPage: 4, postponementsPage: 2 })
    expect(parseHistoryFilters(serializeHistoryFilters(original))).toEqual(original)
  })
})

describe('applyHistoryPatch', () => {
  const current = filters({ desde: '2026-01-01', servicesPage: 3, postponementsPage: 2 })

  it('cambiar el período vuelve las dos listas a la página 1', () => {
    expect(applyHistoryPatch(current, { hasta: '2026-06-30' })).toMatchObject({
      hasta: '2026-06-30',
      servicesPage: 1,
      postponementsPage: 1,
    })
    expect(applyHistoryPatch(current, { desde: null })).toMatchObject({ desde: null, servicesPage: 1 })
  })

  it('cambiar la página de una lista no toca la otra ni el período', () => {
    expect(applyHistoryPatch(current, { servicesPage: 4 })).toEqual({ ...current, servicesPage: 4 })
    expect(applyHistoryPatch(current, { postponementsPage: 5 })).toEqual({ ...current, postponementsPage: 5 })
  })
})

describe('historyRangeError', () => {
  it('avisa si "desde" es posterior a "hasta"', () => {
    expect(historyRangeError(filters({ desde: '2026-07-01', hasta: '2026-06-30' }))).toMatch(/posterior/)
  })

  it('acepta un período válido, el mismo día y los límites abiertos', () => {
    expect(historyRangeError(filters({ desde: '2026-06-30', hasta: '2026-06-30' }))).toBeNull()
    expect(historyRangeError(filters({ desde: '2026-06-30' }))).toBeNull()
    expect(historyRangeError(filters({ hasta: '2026-06-30' }))).toBeNull()
    expect(historyRangeError(DEFAULT_HISTORY_FILTERS)).toBeNull()
  })
})

describe('historyFiltersToQuery', () => {
  it('envía solo los límites del período que están definidos', () => {
    expect(historyFiltersToQuery(filters({ desde: '2026-01-01' }))).toEqual({
      desde: '2026-01-01',
      hasta: undefined,
    })
  })
})

describe('historyQueryKey', () => {
  it('cuelga de la unidad, para volver a pedirse al registrar un service o una postergación', () => {
    const key = historyQueryKey('AB123CD', 'services', filters())
    expect(key.slice(0, 4)).toEqual(['fleet', 'unit', 'AB123CD', 'history'])
  })

  it('usa la página de cada lista, y es distinta para cada período', () => {
    const f = filters({ servicesPage: 2, postponementsPage: 5 })
    expect(historyQueryKey('X', 'services', f)[5]).toMatchObject({ page: 2 })
    expect(historyQueryKey('X', 'postergaciones', f)[5]).toMatchObject({ page: 5 })
    expect(historyQueryKey('X', 'services', filters({ desde: '2026-01-01' }))).not.toEqual(
      historyQueryKey('X', 'services', filters()),
    )
  })
})

describe('pageCount', () => {
  it('calcula las páginas y nunca baja de 1', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(HISTORY_PAGE_SIZE)).toBe(1)
    expect(pageCount(HISTORY_PAGE_SIZE + 1)).toBe(2)
  })
})
