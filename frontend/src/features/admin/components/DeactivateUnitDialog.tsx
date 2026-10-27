import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import { useDeactivateUnit } from '../hooks/useAdminUnits'
import type { Unit } from '../types'

interface DeactivateUnitDialogProps {
  open: boolean
  patente: string
  onClose: () => void
  onDone: (unit: Unit) => void
}

const Body = ({ patente, onClose, onDone }: Omit<DeactivateUnitDialogProps, 'open'>) => {
  const [error, setError] = useState<string | null>(null)
  const mutation = useDeactivateUnit(patente)

  const confirm = async () => {
    if (mutation.isPending) return
    setError(null)
    try {
      onDone(await mutation.mutateAsync())
    } catch (cause) {
      // Por ejemplo, un 409 si la unidad todavía tiene un dispositivo vinculado.
      setError(cause instanceof Error ? cause.message : 'No se pudo dar de baja la unidad.')
    }
  }

  return (
    <div className="space-y-4">
      <p>
        La unidad <strong>{patente}</strong> deja de figurar entre las activas y no admite nuevas cargas. Conserva
        todo su historial (services, postergaciones y kilometraje).
      </p>
      <p className="text-sm text-muted">Por ahora el sistema no permite reactivar una unidad dada de baja.</p>

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
          {mutation.isPending ? 'Dando de baja…' : 'Dar de baja'}
        </Button>
      </div>
    </div>
  )
}

/** Confirmación de la baja lógica de una unidad (RF02). El foco empieza en "Cancelar". */
const DeactivateUnitDialog = ({ open, patente, onClose, onDone }: DeactivateUnitDialogProps) => (
  <Dialog open={open} title={`Dar de baja la unidad ${patente}`} onClose={onClose}>
    <Body patente={patente} onClose={onClose} onDone={onDone} />
  </Dialog>
)

export default DeactivateUnitDialog
