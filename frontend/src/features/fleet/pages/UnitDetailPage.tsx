// UnitDetailPage.tsx — detalle de una unidad (CU08 · RF15), ruta /unidades/:patente
import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../../../api/client'
import { APP_NAME } from '../../../config/app'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { readReturnTarget } from '../../../shared/navigation/returnTarget'
import UnitDetail from '../components/UnitDetail'
import { useUnitDetail } from '../hooks/useUnitDetail'

const FLEET_LIST = { path: '/unidades', label: 'la flota' }

const BackLink = ({ path, label }: { path: string; label: string }) => (
  <p className="mb-3">
    <Link to={path} className="text-accent underline">
      ← Volver a {label}
    </Link>
  </p>
)

const UnitDetailPage = () => {
  const { patente = '' } = useParams()
  const location = useLocation()
  // Si se llegó desde un listado (con filtros) se vuelve a él; si se entró directo, a la flota.
  const back = readReturnTarget(location.state, FLEET_LIST)
  useDocumentTitle(`Unidad ${patente} - ${APP_NAME}`)
  const { data, error, isPending } = useUnitDetail(patente)
  const retry = useRetryFailedQueries()

  if (isPending && !error) {
    return (
      <>
        <BackLink {...back} />
        <LoaderSpinner label={`Cargando la unidad ${patente}…`} />
      </>
    )
  }

  if (error && !data) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <>
          <BackLink {...back} />
          <Card role="alert" className="space-y-2">
            <h1 className="text-xl font-bold">Unidad no encontrada</h1>
            <p>{error.message}</p>
          </Card>
        </>
      )
    }
    return (
      <>
        <BackLink {...back} />
        <ErrorPanel
          title={`No se pudo cargar la unidad ${patente}`}
          error={error}
          onRetry={retry}
        />
      </>
    )
  }

  if (!data) return null

  return (
    <>
      <BackLink {...back} />
      {error && (
        <div className="mb-3">
          <ErrorPanel title="No se pudo actualizar la unidad" error={error} onRetry={retry} />
        </div>
      )}
      <UnitDetail detalle={data} />
    </>
  )
}

export default UnitDetailPage
