import { describe, expect, it } from 'vitest'
import { readReturnTarget, returnState } from '../../../../src/shared/navigation/returnTarget'

const FALLBACK = { path: '/unidades', label: 'la flota' }

describe('readReturnTarget', () => {
  it('recupera el listado de origen, con sus filtros, del estado de navegación', () => {
    const state = returnState('/unidades?tenencia=fletero&estado=vencida', 'la flota')
    expect(readReturnTarget(state, FALLBACK)).toEqual({
      path: '/unidades?tenencia=fletero&estado=vencida',
      label: 'la flota',
    })
  })

  it('si se entró directo (sin estado), vuelve al destino por defecto', () => {
    expect(readReturnTarget(undefined, FALLBACK)).toEqual(FALLBACK)
    expect(readReturnTarget(null, FALLBACK)).toEqual(FALLBACK)
    expect(readReturnTarget({}, FALLBACK)).toEqual(FALLBACK)
  })

  it('ignora destinos que no son rutas internas', () => {
    for (const path of ['https://sitio.externo/x', '//sitio.externo/x', 'unidades', 'javascript:alert(1)']) {
      expect(readReturnTarget(returnState(path, 'x'), FALLBACK)).toEqual(FALLBACK)
    }
  })

  it('ignora un estado con forma inesperada', () => {
    expect(readReturnTarget({ returnTo: { path: 42, label: 'x' } }, FALLBACK)).toEqual(FALLBACK)
    expect(readReturnTarget({ returnTo: { path: '/alertas', label: '' } }, FALLBACK)).toEqual(FALLBACK)
  })
})
