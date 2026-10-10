// FleetPage.tsx — vista de la flota con filtros (CU07 · RF14), ruta /unidades
import { APP_NAME } from '../../../config/app'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { returnState } from '../../../shared/navigation/returnTarget'
import FleetFilters from '../components/FleetFilters'
import UnitCard from '../components/UnitCard'
import { useFleet } from '../hooks/useFleet'
import { useFleetFilters } from '../hooks/useFleetFilters'
import { hasRefinement } from '../utils/filters'

const FleetPage = () => {
  useDocumentTitle(`Flota - ${APP_NAME}`)
  const { filters, setFilters, reset, search } = useFleetFilters()
  const { data, error, isPending } = useFleet(filters)
  const retry = useRetryFailedQueries()

  const refined = hasRefinement(filters)
  const situation = filters.activa ? 'activas' : 'dadas de baja'
  // Al abrir una unidad se informa a qué listado (con sus filtros) volver.
  const linkState = returnState(`/unidades${search}`, 'la flota')

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Flota</h1>

      <FleetFilters filters={filters} onChange={setFilters} onReset={reset} />

      {isPending && !error && <LoaderSpinner label="Cargando flota…" />}

      {error && (
        <ErrorPanel
          title={data ? 'No se pudo actualizar la flota' : 'No se pudo cargar la flota'}
          error={error}
          onRetry={retry}
        />
      )}

      {data && data.unidades.length === 0 && (
        <Card>
          <p>
            {refined
              ? 'No hay unidades que coincidan con los filtros.'
              : `No hay unidades ${situation} registradas.`}
          </p>
        </Card>
      )}

      {data && data.unidades.length > 0 && (
        <>
          <p className="mb-3 text-muted" aria-live="polite">
            {data.unidades.length === 1 ? '1 unidad' : `${data.unidades.length} unidades`} {situation}
            {refined && ' que coinciden con los filtros'}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.unidades.map((unidad) => (
              <UnitCard key={unidad.patente} unidad={unidad} linkState={linkState} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export default FleetPage
