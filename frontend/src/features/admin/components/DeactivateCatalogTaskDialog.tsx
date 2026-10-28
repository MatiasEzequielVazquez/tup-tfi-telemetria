import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog'
import { useUpdateCatalogTask } from '../hooks/useCatalog'
import type { CatalogTask } from '../types'

interface DeactivateCatalogTaskDialogProps {
  open: boolean
  task: CatalogTask
  onClose: () => void
  onDone: (task: CatalogTask) => void
}

/** Confirmación de la baja lógica de una tarea del catálogo (RF07). */
const DeactivateCatalogTaskDialog = ({ open, task, onClose, onDone }: DeactivateCatalogTaskDialogProps) => {
  const mutation = useUpdateCatalogTask(task.codigo)

  return (
    <ConfirmDialog
      open={open}
      title={`Dar de baja ${task.nombre}`}
      confirmLabel="Dar de baja"
      pendingLabel="Dando de baja…"
      failureMessage="No se pudo dar de baja la tarea."
      onConfirm={async () => onDone(await mutation.mutateAsync({ activa: false }))}
      onClose={onClose}
    >
      <p>
        <strong>{task.nombre}</strong> deja de poder asignarse a más unidades. Los planes que ya la tienen, con sus
        services, postergaciones y alertas, siguen como están.
      </p>
      <p className="text-sm text-muted">Se puede reactivar cuando haga falta.</p>
    </ConfirmDialog>
  )
}

export default DeactivateCatalogTaskDialog
