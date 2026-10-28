// AdminUnitPlanPage.tsx — plan de mantenimiento de una unidad: asignar tareas del catálogo,
// ajustar su intervalo y su aviso, y darlas de baja o reactivarlas (CU04 · RF07, RN03), ruta
// /administracion/unidades/:patente/plan. Solo para administradores (RN11).
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../../api/client'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { formatKm } from '../../../shared/utils/formatKm'
import AdminPlanItem from '../components/AdminPlanItem'
import AssignTaskDialog from '../components/AssignTaskDialog'
import { useCatalog } from '../hooks/useCatalog'
import { useAdminUnit, useUnitPlans } from '../hooks/usePlans'
import { assignableTasks } from '../utils/planForm'

const BackLink = () => (
  <p className="mb-3">
    <Link to="/administracion/unidades" className="text-accent underline">
      ← Volver a las unidades
    </Link>
  </p>
)

const AdminUnitPlanPage = () => {
  const { patente = '' } = useParams()
  useDocumentTitle(`Plan de ${patente} - ${APP_NAME}`)
  const unit = useAdminUnit(patente)
  const plans = useUnitPlans(patente)
  // Para asignar solo se ofrecen las tareas activas del catálogo.
  const catalog = useCatalog({ activa: true })
  const retry = useRetryFailedQueries()
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const failure = unit.error ?? plans.error ?? catalog.error
  const loading = (unit.isPending || plans.isPending || catalog.isPending) && !failure

  if (loading) {
    return (
      <>
        <BackLink />
        <LoaderSpinner label={`Cargando el plan de ${patente}…`} />
      </>
    )
  }

  if (unit.error instanceof ApiError && unit.error.status === 404) {
    return (
      <>
        <BackLink />
        <Card role="alert" className="space-y-2">
          <h1 className="text-xl font-bold">Unidad no encontrada</h1>
          <p>{unit.error.message}</p>
        </Card>
      </>
    )
  }

  if (!unit.data || !plans.data || !catalog.data) {
    return (
      <>
        <BackLink />
        <ErrorPanel title={`No se pudo cargar el plan de ${patente}`} error={failure} onRetry={retry} />
      </>
    )
  }

  const { data: unidad } = unit
  const available = assignableTasks(catalog.data, plans.data)
  const activePlans = plans.data.filter((plan) => plan.activo)
  const inactivePlans = plans.data.filter((plan) => !plan.activo)

  return (
    <>
      <BackLink />
      <h1 className="text-2xl font-bold">Plan de mantenimiento · {patente}</h1>
      <p className="mb-3 text-muted">
        {[unidad.marca, unidad.modelo].filter(Boolean).join(' ')} · Kilometraje actual: {formatKm(unidad.km_actual)}
      </p>

      {failure && (
        <div className="mb-3">
          <ErrorPanel title="No se pudo actualizar el plan" error={failure} onRetry={retry} />
        </div>
      )}

      {!unidad.activa && (
        <Card role="note" className="mb-3">
          <p>La unidad está dada de baja: su plan se puede consultar pero no modificar.</p>
        </Card>
      )}

      {/* Región viva: anuncia el resultado confirmado de la última acción. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {unidad.activa && (
        <div className="mb-3 space-y-2">
          {available.length > 0 ? (
            <Button
              onClick={() => {
                setNotice(null)
                setAssigning(true)
              }}
            >
              Asignar tarea
            </Button>
          ) : (
            <p className="text-muted">
              {plans.data.length === 0
                ? 'El catálogo no tiene tareas activas para asignar.'
                : 'La unidad ya tiene todas las tareas activas del catálogo.'}
            </p>
          )}
        </div>
      )}

      {activePlans.length === 0 ? (
        <Card>
          <p>
            {inactivePlans.length === 0
              ? 'Esta unidad no tiene tareas de mantenimiento asignadas.'
              : 'Esta unidad no tiene tareas de mantenimiento activas.'}
          </p>
        </Card>
      ) : (
        <>
          <h2 className="mb-2 text-lg font-bold">Tareas del plan</h2>
          <ul className="grid gap-3">
            {activePlans.map((plan) => (
              <AdminPlanItem
                key={plan.codigo_tarea}
                patente={patente}
                plan={plan}
                editable={unidad.activa}
                onDone={setNotice}
              />
            ))}
          </ul>
        </>
      )}

      {inactivePlans.length > 0 && (
        <section className="mt-6" aria-labelledby="plan-inactivas">
          <h2 id="plan-inactivas" className="mb-1 text-lg font-bold">
            Tareas dadas de baja
          </h2>
          <p className="mb-2 text-sm text-muted">
            No generan alertas ni cuentan en el estado de la flota. Conservan su historial y se pueden reactivar.
          </p>
          <ul className="grid gap-3">
            {inactivePlans.map((plan) => (
              <AdminPlanItem
                key={plan.codigo_tarea}
                patente={patente}
                plan={plan}
                editable={unidad.activa}
                onDone={setNotice}
              />
            ))}
          </ul>
        </section>
      )}

      <AssignTaskDialog
        open={assigning}
        patente={patente}
        currentKm={unidad.km_actual}
        tasks={available}
        onClose={() => setAssigning(false)}
        onAssigned={(plan) => {
          setNotice(`Tarea asignada: ${plan.nombre}.`)
          setAssigning(false)
        }}
      />
    </>
  )
}

export default AdminUnitPlanPage
