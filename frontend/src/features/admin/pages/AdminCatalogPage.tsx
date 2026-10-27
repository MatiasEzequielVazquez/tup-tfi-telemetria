// AdminCatalogPage.tsx — catálogo de tareas de mantenimiento con sus intervalos por defecto
// (CU04 · RF07, RN03), ruta /administracion/catalogo. Solo para administradores (RN11).
import { useState } from 'react'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { formatKm } from '../../../shared/utils/formatKm'
import CreateCatalogTaskDialog from '../components/CreateCatalogTaskDialog'
import { useCatalog } from '../hooks/useCatalog'

const AdminCatalogPage = () => {
  useDocumentTitle(`Catálogo de tareas - ${APP_NAME}`)
  const { data, error, isPending } = useCatalog()
  const retry = useRetryFailedQueries()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Catálogo de tareas</h1>
        <Button
          onClick={() => {
            setNotice(null)
            setCreating(true)
          }}
        >
          Nueva tarea
        </Button>
      </div>
      <p className="mb-3 text-muted">
        Los tipos de tarea de mantenimiento con su intervalo y su aviso por defecto. Al asignar una tarea a una unidad se
        pueden ajustar para esa unidad.
      </p>

      {/* Región viva: anuncia el resultado confirmado de la última acción. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {isPending && !error && <LoaderSpinner label="Cargando el catálogo…" />}

      {error && (
        <ErrorPanel
          title={data ? 'No se pudo actualizar el catálogo' : 'No se pudo cargar el catálogo'}
          error={error}
          onRetry={retry}
        />
      )}

      {data && data.length === 0 && (
        <Card>
          <p>El catálogo no tiene tareas.</p>
        </Card>
      )}

      {data && data.length > 0 && (
        <ul className="grid gap-3">
          {data.map((task) => (
            <Card as="li" key={task.codigo} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">{task.nombre}</h2>
                <p className="text-sm text-muted">{task.codigo}</p>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Dato etiqueta="Intervalo por defecto">{formatKm(task.intervalo_km_default)}</Dato>
                <Dato etiqueta="Aviso por defecto">{formatKm(task.umbral_aviso_km_default)}</Dato>
              </dl>
            </Card>
          ))}
        </ul>
      )}

      <CreateCatalogTaskDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(task) => {
          setNotice(`Tarea ${task.nombre} creada.`)
          setCreating(false)
        }}
      />
    </>
  )
}

export default AdminCatalogPage
