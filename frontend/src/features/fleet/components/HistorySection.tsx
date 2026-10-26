import { useEffect, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { PageResult } from '../../../api/pagination'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import Pagination from '../../../shared/components/ui/Pagination'
import { pageCount } from '../utils/history'

interface HistorySectionProps<T> {
  id: string
  title: string
  /** Texto de la cantidad total, ej. "3 services". */
  countLabel: (total: number) => string
  emptyText: string
  query: UseQueryResult<PageResult<T>>
  page: number
  onPageChange: (page: number) => void
  onRetry: () => void
  /** Devuelve el elemento <li> del item, con su `key`. */
  renderItem: (item: T) => ReactNode
}

/** Un listado paginado del historial: estados de carga, error y vacío, y sus páginas. */
const HistorySection = <T,>({
  id,
  title,
  countLabel,
  emptyText,
  query,
  page,
  onPageChange,
  onRetry,
  renderItem,
}: HistorySectionProps<T>) => {
  const { data, error, isPending } = query
  const pages = data ? pageCount(data.total) : 1

  // Una página fuera de rango (por ejemplo, editada en la URL) vuelve a la última.
  useEffect(() => {
    if (data && data.total > 0 && page > pages) onPageChange(pages)
  }, [data, page, pages, onPageChange])

  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="mb-2 text-xl font-semibold">
        {title}
      </h2>

      {isPending && !error && <LoaderSpinner label={`Cargando ${title.toLowerCase()}…`} />}

      {error && (
        <ErrorPanel
          title={data ? `No se pudo actualizar: ${title.toLowerCase()}` : `No se pudo cargar: ${title.toLowerCase()}`}
          error={error}
          onRetry={onRetry}
        />
      )}

      {data && data.total === 0 && (
        <Card>
          <p>{emptyText}</p>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="mb-3 text-muted">{countLabel(data.total)}</p>
          <ul className="grid gap-3">
            {data.items.map((item) => renderItem(item))}
          </ul>
          {pages > 1 && (
            <Pagination
              label={`Paginación de ${title.toLowerCase()}`}
              page={Math.min(page, pages)}
              pages={pages}
              onChange={onPageChange}
            />
          )}
        </>
      )}
    </section>
  )
}

export default HistorySection
