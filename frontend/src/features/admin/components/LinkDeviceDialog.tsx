import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import SelectField from '../../../shared/components/ui/SelectField'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import { useAdminUnits } from '../hooks/useAdminUnits'
import { useLinkDevice } from '../hooks/useDevices'
import type { Device } from '../types'
import { linkableUnits, unitOptionLabel } from '../utils/devices'

interface LinkDeviceDialogProps {
  open: boolean
  deviceUid: string
  onClose: () => void
  onLinked: (device: Device) => void
}

const Form = ({ deviceUid, onClose, onLinked }: Omit<LinkDeviceDialogProps, 'open'>) => {
  const units = useAdminUnits(true)
  const retry = useRetryFailedQueries()
  const [patente, setPatente] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useLinkDevice(deviceUid)

  const options = linkableUnits(units.data ?? [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return
    setServerError(null)
    if (patente === '') {
      setError('Elegí una unidad.')
      return
    }

    try {
      onLinked(await mutation.mutateAsync(patente))
    } catch (cause) {
      // Por ejemplo, un 409 de RN02 si entre tanto alguno de los dos quedó ocupado.
      setServerError(cause instanceof Error ? cause.message : 'No se pudo vincular el dispositivo.')
    }
  }

  if (units.isPending && !units.error) return <LoaderSpinner label="Cargando unidades…" />
  if (units.error && !units.data) {
    return <ErrorPanel title="No se pudieron cargar las unidades" error={units.error} onRetry={retry} />
  }

  if (options.length === 0) {
    return (
      <div className="space-y-4">
        <p>No hay unidades activas sin dispositivo. Una unidad tiene como máximo un dispositivo (RN02).</p>
        <p className="text-sm text-muted">
          Para vincular este dispositivo, creá una unidad nueva o desvinculá el de otra.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" data-autofocus onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <SelectField
        label="Unidad"
        required
        data-autofocus
        value={patente}
        options={[
          { value: '', label: 'Elegí una unidad' },
          ...options.map((unit) => ({ value: unit.patente, label: unitOptionLabel(unit) })),
        ]}
        onChange={(value) => {
          setPatente(value)
          setError(null)
        }}
        error={error ?? undefined}
      />
      <p className="text-sm text-muted">Solo se ofrecen las unidades activas que todavía no tienen dispositivo.</p>

      {serverError && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending ? 'Vinculando…' : 'Vincular'}
        </Button>
      </div>
    </form>
  )
}

/** Vincula un dispositivo a una unidad (CU03 · RF03, RN02). */
const LinkDeviceDialog = ({ open, deviceUid, onClose, onLinked }: LinkDeviceDialogProps) => (
  <Dialog open={open} title={`Vincular ${deviceUid} a una unidad`} onClose={onClose}>
    <Form deviceUid={deviceUid} onClose={onClose} onLinked={onLinked} />
  </Dialog>
)

export default LinkDeviceDialog
