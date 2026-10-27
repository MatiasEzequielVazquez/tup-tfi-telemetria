import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import TextField from '../../../shared/components/ui/TextField'
import { useCreateDevice } from '../hooks/useDevices'
import type { Device } from '../types'
import { validateDeviceUid } from '../utils/devices'

interface CreateDeviceDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (device: Device) => void
}

const Form = ({ onClose, onCreated }: Omit<CreateDeviceDialogProps, 'open'>) => {
  const [uid, setUid] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useCreateDevice()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateDeviceUid(uid)
    setError(found)
    setServerError(null)
    if (found) return

    try {
      onCreated(await mutation.mutateAsync(uid.trim()))
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : 'No se pudo crear el dispositivo.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <TextField
        label="Identificador del dispositivo"
        required
        data-autofocus
        autoComplete="off"
        value={uid}
        onChange={(value) => {
          setUid(value)
          setError(null)
        }}
        hint="El que envía el firmware en cada mensaje, por ejemplo esp32-0F3A21."
        error={error ?? undefined}
      />
      <p className="text-sm text-muted">
        El dispositivo se crea sin vincular y queda inactivo hasta que envía su primer mensaje.
      </p>

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
          {mutation.isPending ? 'Guardando…' : 'Crear dispositivo'}
        </Button>
      </div>
    </form>
  )
}

/** Alta de un dispositivo (CU03 · RF03): solo su identificador. */
const CreateDeviceDialog = ({ open, onClose, onCreated }: CreateDeviceDialogProps) => (
  <Dialog open={open} title="Nuevo dispositivo" onClose={onClose}>
    <Form onClose={onClose} onCreated={onCreated} />
  </Dialog>
)

export default CreateDeviceDialog
