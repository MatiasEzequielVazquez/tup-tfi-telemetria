import { useMemo, useState } from 'react'
import type { DetalleUnidad } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import { formatDateOnly } from '../../../shared/utils/formatDate'
import { canRegisterService, sortPlansByUrgency } from '../utils/service'
import ServiceForm from './ServiceForm'

interface ServiceActionProps {
  unidad: DetalleUnidad['unidad']
  planes: DetalleUnidad['planes']
}

/**
 * "Registrar service" (CU09) en el plan de la unidad: el botón, el formulario en un diálogo y
 * el aviso del resultado. Siempre está montado, porque al confirmar los datos se refrescan y
 * el aviso tiene que seguir visible.
 */
const ServiceAction = ({ unidad, planes }: ServiceActionProps) => {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const sortedPlans = useMemo(() => sortPlansByUrgency(planes), [planes])
  const eligible = canRegisterService(unidad.activa, planes)

  return (
    <div className={eligible || notice ? 'mb-3 space-y-2' : undefined}>
      {/* Región viva: anuncia el resultado confirmado del último service. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {eligible && (
        <Button
          onClick={() => {
            setNotice(null)
            setOpen(true)
          }}
        >
          Registrar service
        </Button>
      )}

      <Dialog open={open} title={`Registrar service de ${unidad.patente}`} onClose={() => setOpen(false)}>
        <ServiceForm
          patente={unidad.patente}
          currentKm={unidad.km_actual}
          planes={sortedPlans}
          onCancel={() => setOpen(false)}
          onSaved={(service) => {
            const tareas = service.tareas.map((tarea) => tarea.nombre).join(', ')
            setNotice(`Service registrado el ${formatDateOnly(service.fecha)}: ${tareas}.`)
            setOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}

export default ServiceAction
