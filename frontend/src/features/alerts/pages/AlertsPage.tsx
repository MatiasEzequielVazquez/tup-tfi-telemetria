// AlertsPage.tsx — alertas abiertas y revisadas (CU12 · RF12-RF13), ruta /alertas
import { useEffect } from 'react'
import { APP_NAME } from '../../../config/app'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import AlertFilters from '../components/AlertFilters'
import AlertItem from '../components/AlertItem'
import Pagination from '../components/Pagination'
import { useAlertFilters } from '../hooks/useAlertFilters'
import { useAlerts, useUnitOptions } from '../hooks/useAlerts'
import { useReviewAlerts } from '../hooks/useReviewAlerts'
import { STATUS_FILTER_LABELS, pageCount } from '../utils/filters'
import { alertKey } from '../utils/identity'

interface AlertsPageProps {
  /** Ruta del detalle de una unidad. Lo aporta routes, para no acoplar alerts con fleet. */
  unitPath: (patente: string) => string
}

const emptyMessage = (estado: 'abierta' | 'revisada' | 'todas', refined: boolean): string => {
  if (refined) return 'No hay alertas que coincidan con los filtros.'
  if (estado === 'abierta') return 'No hay alertas abiertas.'
  if (estado === 'revisada') return 'No hay alertas revisadas.'
  return 'No hay alertas registradas.'
}

const AlertsPage = ({ unitPath }: AlertsPageProps) => {
  useDocumentTitle(`Alertas - ${APP_NAME}`)
  const { filters, setFilters, reset, search } = useAlertFilters()
  const { data, error, isPending } = useAlerts(filters)
  const units = useUnitOptions()
  const retry = useRetryFailedQueries()
  const { review, isReviewing, errorFor, announcement, clearAnnouncement } = useReviewAlerts()

  const pages = data ? pageCount(data.total) : 1

  // Si al revisar una alerta baja el total y la página queda fuera de rango, se vuelve a la última.
  useEffect(() => {
    if (data && filters.page > pages) setFilters({ page: pages })
  }, [data, filters.page, pages, setFilters])

  const refined = filters.tipo !== null || filters.patente !== null

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Alertas</h1>

      <AlertFilters
        filters={filters}
        unitOptions={units.data}
        unitOptionsFailed={units.isError}
        onChange={(patch) => {
          clearAnnouncement()
          setFilters(patch)
        }}
        onReset={() => {
          clearAnnouncement()
          reset()
        }}
      />

      {/* Región viva: anuncia el resultado confirmado de la última revisión. */}
      <div role="status" aria-live="polite">
        {announcement && (
          <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {announcement}
          </p>
        )}
      </div>

      {isPending && !error && <LoaderSpinner label="Cargando alertas…" />}

      {error && (
        <ErrorPanel
          title={data ? 'No se pudieron actualizar las alertas' : 'No se pudieron cargar las alertas'}
          error={error}
          onRetry={retry}
        />
      )}

      {data && data.items.length === 0 && (
        <Card>
          <p>{emptyMessage(filters.estado, refined)}</p>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="mb-3 text-muted">
            {data.total === 1 ? '1 alerta' : `${data.total} alertas`} ·{' '}
            {STATUS_FILTER_LABELS[filters.estado].toLowerCase()}
            {refined && ' · con los filtros aplicados'}
          </p>
          <ul className="grid gap-3">
            {data.items.map((alerta) => (
              <AlertItem
                key={alertKey(alerta)}
                alerta={alerta}
                unitPath={unitPath}
                search={search}
                reviewing={isReviewing(alerta)}
                error={errorFor(alerta)}
                onReview={(item) => void review(item)}
              />
            ))}
          </ul>
          {pages > 1 && (
            <Pagination
              page={Math.min(filters.page, pages)}
              pages={pages}
              onChange={(page) => {
                clearAnnouncement()
                setFilters({ page })
              }}
            />
          )}
        </>
      )}
    </>
  )
}

export default AlertsPage
