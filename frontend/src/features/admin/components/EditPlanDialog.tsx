import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import TextField from '../../../shared/components/ui/TextField'
import { useUpdatePlan } from '../hooks/usePlans'
import type { UnitPlan } from '../types'
import {
  buildEditPlanBody,
  hasPlanChanges,
  planToValues,
  validateEditPlan,
  type EditPlanErrors,
  type EditPlanValues,
} from '../utils/planForm'

interface EditPlanDialogProps {
  open: boolean
  patente: string
  plan: UnitPlan
  onClose: () => void
  onSaved: (plan: UnitPlan) => void
}

const Form = ({ patente, plan, onClose, onSaved }: Omit<EditPlanDialogProps, 'open'>) => {
  const [values, setValues] = useState<EditPlanValues>(() => planToValues(plan))
  const [errors, setErrors] = useState<EditPlanErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useUpdatePlan(patente, plan.codigo_tarea)

  const change = (field: keyof EditPlanValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateEditPlan(values)
    setErrors(found)
    setMessage(null)
    if (Object.keys(found).length > 0) return

    const body = buildEditPlanBody(values, plan)
    if (!hasPlanChanges(body)) {
      setMessage('No hay cambios para guardar.')
      return
    }

    try {
      onSaved(await mutation.mutateAsync(body))
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar el plan.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Intervalo (km)"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          required
          data-autofocus
          value={values.intervalo}
          onChange={change('intervalo')}
          hint="Cada cuántos km se hace."
          error={errors.intervalo}
        />
        <TextField
          label="Aviso (km)"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          required
          value={values.umbral}
          onChange={change('umbral')}
          hint="Se marca próxima con menos de estos km."
          error={errors.umbral}
        />
      </div>
      <p className="text-sm text-muted">El cambio recalcula el estado de la tarea.</p>

      {message && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}

/** Edita el intervalo y el aviso de una tarea del plan de una unidad (CU04 · RF07, RN03). */
const EditPlanDialog = ({ open, patente, plan, onClose, onSaved }: EditPlanDialogProps) => (
  <Dialog open={open} title={`Editar: ${plan.nombre}`} onClose={onClose}>
    <Form patente={patente} plan={plan} onClose={onClose} onSaved={onSaved} />
  </Dialog>
)

export default EditPlanDialog
