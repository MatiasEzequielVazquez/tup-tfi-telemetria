import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge, { type StatusInfo } from '../../../shared/components/ui/StatusBadge'
import { formatKm } from '../../../shared/utils/formatKm'
import { useUpdatePlan } from '../hooks/usePlans'
import type { UnitPlan } from '../types'
import { planStatusInfo } from '../utils/planForm'
import DeactivatePlanDialog from './DeactivatePlanDialog'
import EditPlanDialog from './EditPlanDialog'

// La baja se muestra con texto e ícono además del color.
const DEACTIVATED: StatusInfo = { label: 'Dada de baja', icon: '✕', tone: 'danger' }

interface AdminPlanItemProps {
  patente: string
  plan: UnitPlan
  /** Si la unidad está dada de baja, el plan se muestra pero no se puede cambiar. */
  editable: boolean
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/**
 * Una tarea del plan de una unidad: su configuración, su estado y sus acciones. Una tarea dada
 * de baja no tiene estado (no se evalúa) y solo se puede reactivar.
 */
const AdminPlanItem = ({ patente, plan, editable, onDone }: AdminPlanItemProps) => {
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [reactivationError, setReactivationError] = useState<string | null>(null)
  const reactivation = useUpdatePlan(patente, plan.codigo_tarea)

  const reactivate = async () => {
    if (reactivation.isPending) return
    setReactivationError(null)
    try {
      const saved = await reactivation.mutateAsync({ activo: true })
      onDone(`Plan reactivado: ${saved.nombre}.`)
    } catch (cause) {
      // Por ejemplo, un 400 si la tarea está dada de baja en el catálogo.
      setReactivationError(cause instanceof Error ? cause.message : 'No se pudo reactivar la tarea del plan.')
    }
  }

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{plan.nombre}</h3>
          <p className="text-sm text-muted">{plan.codigo_tarea}</p>
        </div>
        <StatusBadge status={plan.activo ? planStatusInfo(plan.estado) : DEACTIVATED} />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato etiqueta="Intervalo">{formatKm(plan.intervalo_km)}</Dato>
        <Dato etiqueta="Aviso con menos de">{formatKm(plan.umbral_aviso_km)}</Dato>
        <Dato etiqueta="Último service">{formatKm(plan.km_ultimo_service)}</Dato>
        {plan.activo && <Dato etiqueta="Límite">{formatKm(plan.km_limite)}</Dato>}
      </dl>

      {reactivationError && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {reactivationError}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap gap-3">
          {plan.activo ? (
            <>
              <Button variant="secondary" aria-label={`Editar ${plan.nombre}`} onClick={() => setEditing(true)}>
                Editar
              </Button>
              <Button
                variant="secondary"
                aria-label={`Dar de baja ${plan.nombre}`}
                onClick={() => setDeactivating(true)}
              >
                Dar de baja
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              aria-label={`Reactivar ${plan.nombre}`}
              disabled={reactivation.isPending}
              aria-busy={reactivation.isPending}
              onClick={() => void reactivate()}
            >
              {reactivation.isPending ? 'Reactivando…' : 'Reactivar'}
            </Button>
          )}
        </div>
      )}

      <EditPlanDialog
        open={editing}
        patente={patente}
        plan={plan}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          onDone(`Plan actualizado: ${saved.nombre}.`)
          setEditing(false)
        }}
      />
      <DeactivatePlanDialog
        open={deactivating}
        patente={patente}
        plan={plan}
        onClose={() => setDeactivating(false)}
        onDone={(saved) => {
          onDone(`Plan dado de baja: ${saved.nombre}.`)
          setDeactivating(false)
        }}
      />
    </Card>
  )
}

export default AdminPlanItem
