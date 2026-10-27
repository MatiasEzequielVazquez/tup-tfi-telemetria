import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { formatKm } from '../../../shared/utils/formatKm'
import type { UnitPlan } from '../types'
import { planStatusInfo } from '../utils/planForm'
import EditPlanDialog from './EditPlanDialog'

interface AdminPlanItemProps {
  patente: string
  plan: UnitPlan
  /** Si la unidad está dada de baja, el plan se muestra pero no se puede cambiar. */
  editable: boolean
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/** Una tarea del plan de una unidad: su configuración, su estado y la acción de editarla. */
const AdminPlanItem = ({ patente, plan, editable, onDone }: AdminPlanItemProps) => {
  const [editing, setEditing] = useState(false)

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{plan.nombre}</h2>
          <p className="text-sm text-muted">{plan.codigo_tarea}</p>
        </div>
        <StatusBadge status={planStatusInfo(plan.estado)} />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato etiqueta="Intervalo">{formatKm(plan.intervalo_km)}</Dato>
        <Dato etiqueta="Aviso con menos de">{formatKm(plan.umbral_aviso_km)}</Dato>
        <Dato etiqueta="Último service">{formatKm(plan.km_ultimo_service)}</Dato>
        <Dato etiqueta="Límite">{formatKm(plan.km_limite)}</Dato>
      </dl>

      {editable && (
        <Button variant="secondary" aria-label={`Editar ${plan.nombre}`} onClick={() => setEditing(true)}>
          Editar
        </Button>
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
    </Card>
  )
}

export default AdminPlanItem
