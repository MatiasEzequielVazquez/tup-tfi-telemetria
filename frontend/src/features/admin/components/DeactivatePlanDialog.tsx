import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog'
import { useUpdatePlan } from '../hooks/usePlans'
import type { UnitPlan } from '../types'

interface DeactivatePlanDialogProps {
  open: boolean
  patente: string
  plan: UnitPlan
  onClose: () => void
  onDone: (plan: UnitPlan) => void
}

/** Confirmación de la baja lógica de una tarea del plan de una unidad (RF07). */
const DeactivatePlanDialog = ({ open, patente, plan, onClose, onDone }: DeactivatePlanDialogProps) => {
  const mutation = useUpdatePlan(patente, plan.codigo_tarea)

  return (
    <ConfirmDialog
      open={open}
      title={`Dar de baja ${plan.nombre} en ${patente}`}
      confirmLabel="Dar de baja"
      pendingLabel="Dando de baja…"
      failureMessage="No se pudo dar de baja la tarea del plan."
      onConfirm={async () => onDone(await mutation.mutateAsync({ activo: false }))}
      onClose={onClose}
    >
      <p>
        <strong>{plan.nombre}</strong> deja de evaluarse en <strong>{patente}</strong>: no genera alertas, no cuenta en
        el estado de la flota y no admite services ni postergaciones. Si tiene una postergación abierta, se cierra.
      </p>
      <p className="text-sm text-muted">
        Se conserva el historial. Al reactivarla se vuelve a calcular su estado, y puede pasar a próxima o vencida.
      </p>
    </ConfirmDialog>
  )
}

export default DeactivatePlanDialog
