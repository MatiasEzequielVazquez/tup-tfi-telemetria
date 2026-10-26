import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import { useUnlinkDevice } from '../hooks/useDevices'
import type { Device } from '../types'

interface UnlinkDeviceDialogProps {
  open: boolean
  deviceUid: string
  patente: string
  onClose: () => void
  onUnlinked: (device: Device) => void
}

const Body = ({ deviceUid, patente, onClose, onUnlinked }: Omit<UnlinkDeviceDialogProps, 'open'>) => {
  const [error, setError] = useState<string | null>(null)
  const mutation = useUnlinkDevice(deviceUid)

  const confirm = async () => {
    if (mutation.isPending) return
    setError(null)
    try {
      onUnlinked(await mutation.mutateAsync())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo desvincular el dispositivo.')
    }
  }

  return (
    <div className="space-y-4">
      <p>
        La unidad <strong>{patente}</strong> deja de recibir lecturas de <strong>{deviceUid}</strong> y el
        dispositivo queda inactivo. Después se puede cargar su kilometraje a mano, vincularle otro dispositivo o
        darla de baja.
      </p>
      <p className="text-sm text-muted">Las lecturas que ya envió se conservan.</p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" data-autofocus onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending}
          onClick={() => void confirm()}
        >
          {mutation.isPending ? 'Desvinculando…' : 'Desvincular'}
        </Button>
      </div>
    </div>
  )
}

/** Confirmación para desvincular un dispositivo de su unidad. El foco empieza en "Cancelar". */
const UnlinkDeviceDialog = ({ open, deviceUid, patente, onClose, onUnlinked }: UnlinkDeviceDialogProps) => (
  <Dialog open={open} title={`Desvincular ${deviceUid}`} onClose={onClose}>
    <Body deviceUid={deviceUid} patente={patente} onClose={onClose} onUnlinked={onUnlinked} />
  </Dialog>
)

export default UnlinkDeviceDialog
