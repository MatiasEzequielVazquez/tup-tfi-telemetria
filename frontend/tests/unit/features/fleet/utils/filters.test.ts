import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FLEET_FILTERS,
  STATE_FILTER_LABELS,
  fleetFiltersToQuery,
  fleetListQueryKey,
  hasRefinement,
  parseFleetFilters,
  serializeFleetFilters,
} from '../../../../../src/features/fleet/utils/filters'

const parse = (search: string) => parseFleetFilters(new URLSearchParams(search))

describe('parseFleetFilters', () => {
  it('sin parámetros devuelve el estado por defecto: todas, todos, activas', () => {
    expect(parse('')).toEqual(DEFAULT_FLEET_FILTERS)
  })

  it('lee los valores que admite la API, incluidos todos los estados', () => {
    for (const estado of Object.keys(STATE_FILTER_LABELS)) {
      expect(parse(`estado=${estado}`).estado).toBe(estado)
    }
    expect(parse('tenencia=fletero&activa=false')).toEqual({
      tenencia: 'fletero',
      estado: null,
      activa: false,
    })
  })

  it('normaliza valores inválidos para no enviarlos a la API', () => {
    expect(parse('tenencia=camion&estado=roto&activa=quizas')).toEqual(DEFAULT_FLEET_FILTERS)
    expect(parse('estado=AL_DIA').estado).toBeNull() // distingue mayúsculas
    expect(parse('tenencia=').tenencia).toBeNull()
  })
})

describe('serializeFleetFilters', () => {
  it('solo escribe lo que no tiene el valor por defecto', () => {
    expect(serializeFleetFilters(DEFAULT_FLEET_FILTERS).toString()).toBe('')
    expect(
      serializeFleetFilters({ tenencia: 'propia', estado: 'vencida', activa: false }).toString(),
    ).toBe('tenencia=propia&estado=vencida&activa=false')
  })

  it('es el inverso de parse', () => {
    const filters = { tenencia: 'fletero', estado: 'sin_dispositivo', activa: false } as const
    expect(parseFleetFilters(serializeFleetFilters(filters))).toEqual(filters)
  })
})

describe('fleetFiltersToQuery y fleetListQueryKey', () => {
  it('traduce a los parámetros de GET /unidades', () => {
    expect(fleetFiltersToQuery({ tenencia: 'propia', estado: null, activa: true })).toEqual({
      tenencia: 'propia',
      estado: undefined,
      activa: true,
    })
  })

  it('la clave de consulta distingue cada combinación de filtros', () => {
    const base = fleetListQueryKey(DEFAULT_FLEET_FILTERS)
    const keys = [
      fleetListQueryKey({ ...DEFAULT_FLEET_FILTERS, tenencia: 'propia' }),
      fleetListQueryKey({ ...DEFAULT_FLEET_FILTERS, tenencia: 'fletero' }),
      fleetListQueryKey({ ...DEFAULT_FLEET_FILTERS, estado: 'vencida' }),
      fleetListQueryKey({ ...DEFAULT_FLEET_FILTERS, activa: false }),
    ].map((key) => JSON.stringify(key))

    expect(new Set([JSON.stringify(base), ...keys]).size).toBe(5)
    expect(JSON.stringify(fleetListQueryKey({ ...DEFAULT_FLEET_FILTERS }))).toBe(JSON.stringify(base))
  })
})

describe('hasRefinement', () => {
  it('la situación activa/baja no cuenta como refinamiento', () => {
    expect(hasRefinement({ ...DEFAULT_FLEET_FILTERS, activa: false })).toBe(false)
    expect(hasRefinement({ ...DEFAULT_FLEET_FILTERS, estado: 'proxima' })).toBe(true)
    expect(hasRefinement({ ...DEFAULT_FLEET_FILTERS, tenencia: 'propia' })).toBe(true)
  })
})
