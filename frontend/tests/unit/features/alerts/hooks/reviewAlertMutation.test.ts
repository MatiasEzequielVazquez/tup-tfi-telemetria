import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reviewAlertMutationOptions } from '../../../../../src/features/alerts/hooks/useReviewAlerts'
import type { Alerta } from '../../../../../src/features/alerts/types'

const open: Alerta = {
  origen: 'falla',
  tipo: 'falla_nueva',
  patente: 'MJ539WD',
  referencia: 'SPN-100-FMI-3',
  referencia_nombre: null,
  fecha_generada: '2026-10-05T10:00:00Z',
  fecha_revisada: null,
  estado: 'abierta',
  clave: { patente: 'MJ539WD', codigo: 'SPN-100-FMI-3', fecha_aparicion: '2026-10-05T09:00:00Z' },
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
let queryClient: QueryClient

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://api.test/api/v1')
  vi.stubGlobal('fetch', fetchMock)
  queryClient = new QueryClient()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const observe = () => new MutationObserver(queryClient, reviewAlertMutationOptions(queryClient))

describe('mutación de revisión de alertas', () => {
  it('al confirmar el servidor invalida solo las listas de alertas', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ...open, estado: 'revisada', fecha_revisada: '2026-10-07T15:00:00Z' }),
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()

    const confirmed = await observe().mutate(open)

    expect(confirmed.estado).toBe('revisada')
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['alerts', 'list'] })
  })

  it('sigue en curso hasta que las listas se actualizaron (no se rehabilita con datos viejos)', async () => {
    fetchMock.mockResolvedValueOnce(json({ ...open, estado: 'revisada' }))
    let finishRefresh!: () => void
    vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(
      new Promise<void>((resolve) => {
        finishRefresh = resolve
      }),
    )
    const observer = observe()

    const pending = observer.mutate(open)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(observer.getCurrentResult().status).toBe('pending')

    finishRefresh()
    await pending
    expect(observer.getCurrentResult().status).toBe('success')
  })

  it('si el servidor rechaza, falla con su mensaje y no invalida nada', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: 'no_encontrado', message: 'No existe esa alerta.' } }, 404),
    )
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()

    await expect(observe().mutate(open)).rejects.toMatchObject({
      status: 404,
      message: 'No existe esa alerta.',
    })
    expect(invalidate).not.toHaveBeenCalled()
  })
})
