import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog'
import { useDeactivateUnit } from '../hooks/useAdminUnits'
import type { Unit } from '../types'

interface DeactivateUnitDialogProps {
  open: boolean
  patente: string
  onClose: () => void
  onDone: (unit: Unit) => void
}

/** Confirmación de la baja lógica de una unidad (RF02). Un 409 (dispositivo vinculado) se muestra tal cual. */
const DeactivateUnitDialog = ({ open, patente, onClose, onDone }: DeactivateUnitDialogProps) => {
  const mutation = useDeactivateUnit(patente)

  return (
    <ConfirmDialog
      open={open}
      title={`Dar de baja la unidad ${patente}`}
      confirmLabel="Dar de baja"
      pendingLabel="Dando de baja…"
      failureMessage="No se pudo dar de baja la unidad."
      onConfirm={async () => onDone(await mutation.mutateAsync())}
      onClose={onClose}
    >
      <p>
        La unidad <strong>{patente}</strong> deja de figurar entre las activas y no admite nuevas cargas. Conserva
        todo su historial (services, postergaciones y kilometraje).
      </p>
      <p className="text-sm text-muted">Por ahora el sistema no permite reactivar una unidad dada de baja.</p>
    </ConfirmDialog>
  )
}

export default DeactivateUnitDialog
