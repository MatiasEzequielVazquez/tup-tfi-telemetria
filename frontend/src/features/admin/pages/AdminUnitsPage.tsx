// AdminUnitsPage.tsx — gestión de unidades: alta, edición y baja (CU02 · RF02), ruta
// /administracion/unidades. Solo para administradores (RN11).
import { useState } from 'react'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import SelectField from '../../../shared/components/ui/SelectField'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import AdminUnitItem from '../components/AdminUnitItem'
import UnitFormDialog from '../components/UnitFormDialog'
import { useAdminUnits } from '../hooks/useAdminUnits'
import { useAdminUnitsFilter } from '../hooks/useAdminUnitsFilter'

interface AdminUnitsPageProps {
  /** Ruta del detalle de una unidad. Lo aporta routes, para no acoplar admin con fleet. */
  unitPath: (patente: string) => string
}

const SITUATION_OPTIONS = [
  { value: 'activas', label: 'Activas' },
  { value: 'bajas', label: 'Dadas de baja' },
]

const AdminUnitsPage = ({ unitPath }: AdminUnitsPageProps) => {
  useDocumentTitle(`Administración de unidades - ${APP_NAME}`)
  const { activa, setActiva } = useAdminUnitsFilter()
  const { data, error, isPending } = useAdminUnits(activa)
  const retry = useRetryFailedQueries()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const situation = activa ? 'activas' : 'dadas de baja'

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Administración de unidades</h1>
        <Button
          onClick={() => {
            setNotice(null)
            setCreating(true)
          }}
        >
          Nueva unidad
        </Button>
      </div>

      <form
        aria-label="Filtros de unidades"
        onSubmit={(event) => event.preventDefault()}
        className="mb-4 max-w-xs"
      >
        <SelectField
          label="Situación"
          value={activa ? 'activas' : 'bajas'}
          options={SITUATION_OPTIONS}
          onChange={(value) => {
            setNotice(null)
            setActiva(value !== 'bajas')
          }}
        />
      </form>

      {/* Región viva: anuncia el resultado confirmado de la última acción. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {isPending && !error && <LoaderSpinner label="Cargando unidades…" />}

      {error && (
        <ErrorPanel
          title={data ? 'No se pudieron actualizar las unidades' : 'No se pudieron cargar las unidades'}
          error={error}
          onRetry={retry}
        />
      )}

      {data && data.length === 0 && (
        <Card>
          <p>No hay unidades {situation} registradas.</p>
        </Card>
      )}

      {data && data.length > 0 && (
        <>
          <p className="mb-3 text-muted">
            {data.length === 1 ? '1 unidad' : `${data.length} unidades`} {situation}
          </p>
          <ul className="grid gap-3">
            {data.map((unit) => (
              <AdminUnitItem key={unit.patente} unit={unit} unitPath={unitPath} onDone={setNotice} />
            ))}
          </ul>
        </>
      )}

      <UnitFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(unit) => {
          setNotice(`Unidad ${unit.patente} creada.`)
          setCreating(false)
        }}
      />
    </>
  )
}

export default AdminUnitsPage
