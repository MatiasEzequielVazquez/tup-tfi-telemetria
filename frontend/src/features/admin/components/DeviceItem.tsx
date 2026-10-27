import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { formatDate, formatDateTime } from '../../../shared/utils/formatDate'
import type { Device } from '../types'
import { deviceStatusInfo } from '../utils/devices'
import LinkDeviceDialog from './LinkDeviceDialog'
import UnlinkDeviceDialog from './UnlinkDeviceDialog'

interface DeviceItemProps {
  device: Device
  /** Ruta del detalle de una unidad; la aporta quien compone la app (routes). */
  unitPath: (patente: string) => string
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/** Un dispositivo del listado, con su estado, su unidad y las acciones de vincular o desvincular. */
const DeviceItem = ({ device, unitPath, onDone }: DeviceItemProps) => {
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const link = device.vinculacion_actual

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{device.device_uid}</h2>
        <StatusBadge status={deviceStatusInfo(device.estado)} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Dato etiqueta="Unidad">
          {link ? (
            <Link to={unitPath(link.patente)} className="font-semibold text-accent underline">
              {link.patente}
            </Link>
          ) : (
            <span className="text-muted">Sin vincular</span>
          )}
        </Dato>
        <Dato etiqueta="Vinculado desde">
          {link ? formatDate(link.desde) : <span className="text-muted">—</span>}
        </Dato>
        <Dato etiqueta="Última comunicación">
          {device.ultima_comunicacion ? (
            formatDateTime(device.ultima_comunicacion)
          ) : (
            <span className="text-muted">Sin comunicaciones</span>
          )}
        </Dato>
      </dl>

      <div className="flex flex-wrap gap-3">
        {link ? (
          <Button variant="secondary" aria-label={`Desvincular ${device.device_uid}`} onClick={() => setUnlinking(true)}>
            Desvincular
          </Button>
        ) : (
          <Button
            variant="secondary"
            aria-label={`Vincular ${device.device_uid} a una unidad`}
            onClick={() => setLinking(true)}
          >
            Vincular a una unidad
          </Button>
        )}
      </div>

      <LinkDeviceDialog
        open={linking}
        deviceUid={device.device_uid}
        onClose={() => setLinking(false)}
        onLinked={(saved) => {
          onDone(`Dispositivo ${saved.device_uid} vinculado a ${saved.vinculacion_actual?.patente ?? 'la unidad'}.`)
          setLinking(false)
        }}
      />
      {link && (
        <UnlinkDeviceDialog
          open={unlinking}
          deviceUid={device.device_uid}
          patente={link.patente}
          onClose={() => setUnlinking(false)}
          onUnlinked={(saved) => {
            onDone(`Dispositivo ${saved.device_uid} desvinculado de ${link.patente}.`)
            setUnlinking(false)
          }}
        />
      )}
    </Card>
  )
}

export default DeviceItem
