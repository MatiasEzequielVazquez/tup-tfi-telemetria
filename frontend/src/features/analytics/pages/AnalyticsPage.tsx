// AnalyticsPage.tsx — indicadores y gráficos de la flota, ruta /analiticas
import { useMemo } from 'react'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { formatDateTime, toDateOnly } from '../../../shared/utils/formatDate'
import ChartCard from '../components/ChartCard'
import KpiTile from '../components/KpiTile'
import { REFRESH_MS, useFleetAnalytics } from '../hooks/useFleetAnalytics'
import { buildChartSpecs } from '../utils/chartSpecs'
import { buildKpis } from '../utils/kpis'
import { fleetKpis } from '../utils/metrics'

const AnalyticsPage = () => {
  useDocumentTitle(`Analíticas - ${APP_NAME}`)
  const { units, alerts, isPending, error, isFetching, updatedAt, refetch } = useFleetAnalytics()
  const retry = useRetryFailedQueries()

  const unitData = units.data
  const alertData = alerts.data

  const today = toDateOnly(new Date(updatedAt))

  // Los indicadores llevan edades ("hace 3 h"), así que se recalculan en cada actualización.
  const kpis = useMemo(
    () => (unitData && alertData ? buildKpis(fleetKpis(unitData, alertData), new Date(updatedAt)) : null),
    [unitData, alertData, updatedAt],
  )
  // Los gráficos, en cambio, solo se redibujan si cambian los datos o el día: TanStack Query
  // conserva la misma referencia cuando la API devuelve lo mismo, y así no se vuelven a animar
  // cada 30 s sin motivo. `today` cubre el cambio de día.
  const specs = useMemo(
    () => (unitData && alertData ? buildChartSpecs(unitData, alertData, today) : null),
    [unitData, alertData, today],
  )
  const view = kpis && specs ? { kpis, specs } : null

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analíticas</h1>
          <p className="text-muted">Resumen de la flota activa, calculado con los datos de la API.</p>
        </div>
        {view && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="text-sm text-muted">
              Actualizado {formatDateTime(new Date(updatedAt).toISOString())} · cada {REFRESH_MS / 1000} s
            </p>
            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
        )}
      </div>

      {isPending && !error && <LoaderSpinner label="Cargando analíticas…" />}

      {error && (
        <ErrorPanel
          title={view ? 'No se pudieron actualizar las analíticas' : 'No se pudieron cargar las analíticas'}
          error={error}
          onRetry={retry}
        />
      )}

      {view && (
        <div className={error ? 'mt-4' : undefined}>
          <section aria-label="Indicadores">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {view.kpis.map((kpi) => (
                <KpiTile key={kpi.id} kpi={kpi} />
              ))}
            </dl>
          </section>

          <section aria-label="Gráficos" className="mt-4 grid gap-3 lg:grid-cols-2">
            {view.specs.map((spec) => (
              <ChartCard key={spec.id} spec={spec} refreshing={isFetching} />
            ))}
          </section>
        </div>
      )}
    </>
  )
}

export default AnalyticsPage
