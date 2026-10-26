// AdminDevicesPage.tsx — gestión de dispositivos: alta, vincular y desvincular (CU03 · RF03,
// RN02), ruta /administracion/dispositivos. Solo para administradores (RN11).
import { useState } from 'react'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import CreateDeviceDialog from '../components/CreateDeviceDialog'
import DeviceItem from '../components/DeviceItem'
import { useDevices } from '../hooks/useDevices'

interface AdminDevicesPageProps {
  /** Ruta del detalle de una unidad. Lo aporta routes, para no acoplar admin con fleet. */
  unitPath: (patente: string) => string
}

const AdminDevicesPage = ({ unitPath }: AdminDevicesPageProps) => {
  useDocumentTitle(`Administración de dispositivos - ${APP_NAME}`)
  const { data, error, isPending } = useDevices()
  const retry = useRetryFailedQueries()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const linked = data?.filter((device) => device.vinculacion_actual !== null).length ?? 0

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Administración de dispositivos</h1>
        <Button
          onClick={() => {
            setNotice(null)
            setCreating(true)
          }}
        >
          Nuevo dispositivo
        </Button>
      </div>

      {/* Región viva: anuncia el resultado confirmado de la última acción. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {isPending && !error && <LoaderSpinner label="Cargando dispositivos…" />}

      {error && (
        <ErrorPanel
          title={data ? 'No se pudieron actualizar los dispositivos' : 'No se pudieron cargar los dispositivos'}
          error={error}
          onRetry={retry}
        />
      )}

      {data && data.length === 0 && (
        <Card>
          <p>No hay dispositivos registrados.</p>
        </Card>
      )}

      {data && data.length > 0 && (
        <>
          <p className="mb-3 text-muted">
            {data.length === 1 ? '1 dispositivo' : `${data.length} dispositivos`} · {linked} vinculado
            {linked === 1 ? '' : 's'}
          </p>
          <ul className="grid gap-3">
            {data.map((device) => (
              <DeviceItem key={device.device_uid} device={device} unitPath={unitPath} onDone={setNotice} />
            ))}
          </ul>
        </>
      )}

      <CreateDeviceDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(device) => {
          setNotice(`Dispositivo ${device.device_uid} creado.`)
          setCreating(false)
        }}
      />
    </>
  )
}

export default AdminDevicesPage
