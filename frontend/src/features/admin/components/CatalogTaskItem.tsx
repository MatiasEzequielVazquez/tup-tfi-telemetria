import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge, { type StatusInfo } from '../../../shared/components/ui/StatusBadge'
import { formatKm } from '../../../shared/utils/formatKm'
import { useUpdateCatalogTask } from '../hooks/useCatalog'
import type { CatalogTask } from '../types'
import CatalogTaskFormDialog from './CatalogTaskFormDialog'
import DeactivateCatalogTaskDialog from './DeactivateCatalogTaskDialog'

// La baja se muestra con texto e ícono además del color.
const DEACTIVATED: StatusInfo = { label: 'Dada de baja', icon: '✕', tone: 'danger' }

interface CatalogTaskItemProps {
  task: CatalogTask
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/** Una tarea del catálogo, con sus valores por defecto y sus acciones: editar, dar de baja o reactivar. */
const CatalogTaskItem = ({ task, onDone }: CatalogTaskItemProps) => {
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [reactivationError, setReactivationError] = useState<string | null>(null)
  const reactivation = useUpdateCatalogTask(task.codigo)

  const reactivate = async () => {
    if (reactivation.isPending) return
    setReactivationError(null)
    try {
      await reactivation.mutateAsync({ activa: true })
      onDone(`Tarea ${task.nombre} reactivada.`)
    } catch (cause) {
      setReactivationError(cause instanceof Error ? cause.message : 'No se pudo reactivar la tarea.')
    }
  }

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{task.nombre}</h2>
          <p className="text-sm text-muted">{task.codigo}</p>
        </div>
        {!task.activa && <StatusBadge status={DEACTIVATED} />}
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Dato etiqueta="Intervalo por defecto">{formatKm(task.intervalo_km_default)}</Dato>
        <Dato etiqueta="Aviso por defecto">{formatKm(task.umbral_aviso_km_default)}</Dato>
      </dl>

      {!task.activa && (
        <p className="text-sm text-muted">No se puede asignar a más unidades. Sus planes actuales siguen como están.</p>
      )}

      {reactivationError && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {reactivationError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" aria-label={`Editar ${task.nombre}`} onClick={() => setEditing(true)}>
          Editar
        </Button>
        {task.activa ? (
          <Button variant="secondary" aria-label={`Dar de baja ${task.nombre}`} onClick={() => setDeactivating(true)}>
            Dar de baja
          </Button>
        ) : (
          <Button
            variant="secondary"
            aria-label={`Reactivar ${task.nombre}`}
            disabled={reactivation.isPending}
            aria-busy={reactivation.isPending}
            onClick={() => void reactivate()}
          >
            {reactivation.isPending ? 'Reactivando…' : 'Reactivar'}
          </Button>
        )}
      </div>

      <CatalogTaskFormDialog
        open={editing}
        task={task}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          onDone(`Tarea ${saved.nombre} actualizada.`)
          setEditing(false)
        }}
      />
      <DeactivateCatalogTaskDialog
        open={deactivating}
        task={task}
        onClose={() => setDeactivating(false)}
        onDone={(saved) => {
          onDone(`Tarea ${saved.nombre} dada de baja.`)
          setDeactivating(false)
        }}
      />
    </Card>
  )
}

export default CatalogTaskItem
