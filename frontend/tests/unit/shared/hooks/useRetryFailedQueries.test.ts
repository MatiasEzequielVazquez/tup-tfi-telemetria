import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useRetryFailedQueries } from '../../../../src/shared/hooks/useRetryFailedQueries'

/** Obtiene la función de reintento del hook, dentro de un QueryClientProvider. */
const getRetry = (queryClient: QueryClient): (() => void) => {
  const captured: Array<() => void> = []
  const Probe = ({ onReady }: { onReady: (retry: () => void) => void }) => {
    onReady(useRetryFailedQueries())
    return null
  }
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(Probe, { onReady: (retry) => captured.push(retry) }),
    ),
  )
  return captured[0]
}

/** Consulta con observador (en uso por una pantalla), ya resuelta. */
const mount = async (queryClient: QueryClient, key: string, queryFn: () => Promise<string>) => {
  const observer = new QueryObserver(queryClient, { queryKey: [key], queryFn, retry: false })
  const unsubscribe = observer.subscribe(() => {})
  await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
  return unsubscribe
}

describe('useRetryFailedQueries', () => {
  it('reintenta las consultas en uso que fallaron y deja las demás como están', async () => {
    const queryClient = new QueryClient()
    const pageQuery = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValue('ok')
    const headerQuery = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValue('usuario')
    const healthyQuery = vi.fn<() => Promise<string>>().mockResolvedValue('ok')
    const unusedQuery = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('error viejo'))

    const stops = [
      await mount(queryClient, 'pantalla', pageQuery),
      await mount(queryClient, 'encabezado', headerQuery),
      await mount(queryClient, 'sana', healthyQuery),
    ]
    // Una consulta fallida que ninguna pantalla usa: no debe volver a pedirse.
    await queryClient.fetchQuery({ queryKey: ['sin-uso'], queryFn: unusedQuery, retry: false }).catch(() => {})

    getRetry(queryClient)()

    await vi.waitFor(() => {
      expect(queryClient.getQueryState(['pantalla'])?.status).toBe('success')
      expect(queryClient.getQueryState(['encabezado'])?.status).toBe('success')
    })
    expect(pageQuery).toHaveBeenCalledTimes(2)
    expect(headerQuery).toHaveBeenCalledTimes(2)
    expect(healthyQuery).toHaveBeenCalledTimes(1)
    expect(unusedQuery).toHaveBeenCalledTimes(1)

    stops.forEach((stop) => stop())
  })
})
