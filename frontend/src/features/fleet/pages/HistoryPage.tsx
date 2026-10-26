// HistoryPage.tsx — historial de services y postergaciones de una unidad (CU13 · RF16),
// ruta /unidades/:patente/historial
import { Link, useLocation, useParams } from 'react-router'
import { APP_NAME } from '../../../config/app'
import Card from '../../../shared/components/ui/Card'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import HistoryPeriodFilter from '../components/HistoryPeriodFilter'
import HistorySection from '../components/HistorySection'
import PostponementHistoryItem from '../components/PostponementHistoryItem'
import ServiceHistoryItem from '../components/ServiceHistoryItem'
import { useHistoryFilters } from '../hooks/useHistoryFilters'
import { usePostponementHistory, useServiceHistory } from '../hooks/useHistory'
import { historyRangeError } from '../utils/history'

const countText = (singular: string, plural: string) => (total: number) =>
  total === 1 ? `1 ${singular}` : `${total} ${plural}`

const HistoryPage = () => {
  const { patente = '' } = useParams()
  const location = useLocation()
  useDocumentTitle(`Historial de ${patente} - ${APP_NAME}`)
  const { filters, setFilters, reset } = useHistoryFilters()
  const services = useServiceHistory(patente, filters)
  const postponements = usePostponementHistory(patente, filters)
  const retry = useRetryFailedQueries()

  const rangeError = historyRangeError(filters)
  const hasPeriod = filters.desde !== null || filters.hasta !== null

  return (
    <>
      <p className="mb-3">
        {/* Se reenvía el estado de navegación para que el detalle siga sabiendo a qué listado volver. */}
        <Link to={`/unidades/${encodeURIComponent(patente)}`} state={location.state} className="text-accent underline">
          ← Volver a la unidad {patente}
        </Link>
      </p>

      <h1 className="mb-3 text-2xl font-bold">Historial de mantenimiento · {patente}</h1>

      <HistoryPeriodFilter filters={filters} error={rangeError} onChange={setFilters} onReset={reset} />

      {rangeError ? (
        <Card role="alert">
          <p>{rangeError} Corregí el período para ver el historial.</p>
        </Card>
      ) : (
        <>
          <HistorySection
            id="sec-services"
            title="Services"
            countLabel={countText('service', 'services')}
            emptyText={hasPeriod ? 'No hay services en ese período.' : 'Esta unidad no tiene services registrados.'}
            query={services}
            page={filters.servicesPage}
            onPageChange={(page) => setFilters({ servicesPage: page })}
            onRetry={retry}
            renderItem={(service) => (
              <ServiceHistoryItem key={`${service.patente}|${service.fecha}`} service={service} />
            )}
          />
          <HistorySection
            id="sec-postergaciones"
            title="Postergaciones"
            countLabel={countText('postergación', 'postergaciones')}
            emptyText={
              hasPeriod ? 'No hay postergaciones en ese período.' : 'Esta unidad no tiene postergaciones registradas.'
            }
            query={postponements}
            page={filters.postponementsPage}
            onPageChange={(page) => setFilters({ postponementsPage: page })}
            onRetry={retry}
            renderItem={(postergacion) => (
              <PostponementHistoryItem
                key={`${postergacion.codigo_tarea}|${postergacion.fecha}`}
                postergacion={postergacion}
              />
            )}
          />
        </>
      )}
    </>
  )
}

export default HistoryPage
