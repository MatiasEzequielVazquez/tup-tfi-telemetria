import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import SelectField from '../../../shared/components/ui/SelectField'
import TextField from '../../../shared/components/ui/TextField'
import { formatKm } from '../../../shared/utils/formatKm'
import { useAssignTask } from '../hooks/usePlans'
import type { CatalogTask, UnitPlan } from '../types'
import {
  buildAssignBody,
  emptyAssignValues,
  validateAssign,
  withTaskDefaults,
  type AssignFormErrors,
  type AssignFormValues,
} from '../utils/planForm'

interface AssignTaskDialogProps {
  open: boolean
  patente: string
  currentKm: number
  /** Tareas del catálogo que la unidad todavía no tiene. */
  tasks: CatalogTask[]
  onClose: () => void
  onAssigned: (plan: UnitPlan) => void
}

const Form = ({ patente, currentKm, tasks, onClose, onAssigned }: Omit<AssignTaskDialogProps, 'open'>) => {
  const [values, setValues] = useState<AssignFormValues>(emptyAssignValues)
  const [errors, setErrors] = useState<AssignFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useAssignTask(patente)

  const chooseTask = (codigo: string) => {
    setValues((current) => withTaskDefaults(current, tasks.find((task) => task.codigo === codigo)))
    setErrors({})
  }

  const change = (field: 'intervalo' | 'umbral' | 'kmUltimo') => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateAssign(values, currentKm)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return

    try {
      onAssigned(await mutation.mutateAsync(buildAssignBody(values)))
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : 'No se pudo asignar la tarea.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <SelectField
        label="Tarea"
        required
        data-autofocus
        value={values.codigo}
        options={[
          { value: '', label: 'Elegí una tarea del catálogo' },
          ...tasks.map((task) => ({ value: task.codigo, label: task.nombre })),
        ]}
        onChange={chooseTask}
        error={errors.codigo}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Intervalo (km)"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          required
          value={values.intervalo}
          onChange={change('intervalo')}
          hint="Se propone el del catálogo."
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
          hint="Se propone el del catálogo."
          error={errors.umbral}
        />
      </div>

      <TextField
        label="Km del último service (opcional)"
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        value={values.kmUltimo}
        onChange={change('kmUltimo')}
        hint={`Si lo dejás vacío se toma el kilometraje actual (${formatKm(currentKm)}) y la tarea nace al día. Si la unidad ya hizo esta tarea antes, indicá el km de ese service para que el estado sea el real.`}
        error={errors.kmUltimo}
      />

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
          {mutation.isPending ? 'Asignando…' : 'Asignar tarea'}
        </Button>
      </div>
    </form>
  )
}

/** Asigna una tarea del catálogo al plan de una unidad (CU04 · RF07, RN03). */
const AssignTaskDialog = ({ open, patente, currentKm, tasks, onClose, onAssigned }: AssignTaskDialogProps) => (
  <Dialog open={open} title={`Asignar una tarea a ${patente}`} onClose={onClose}>
    <Form patente={patente} currentKm={currentKm} tasks={tasks} onClose={onClose} onAssigned={onAssigned} />
  </Dialog>
)

export default AssignTaskDialog
