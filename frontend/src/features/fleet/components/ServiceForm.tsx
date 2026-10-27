import { useId, useState, type FormEvent } from 'react'
import type { Service } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import TextAreaField from '../../../shared/components/ui/TextAreaField'
import TextField from '../../../shared/components/ui/TextField'
import { todayDateOnly } from '../../../shared/utils/formatDate'
import { useRegisterService } from '../hooks/useRegisterService'
import type { Plan } from '../types'
import { formatKm } from '../../../shared/utils/formatKm'
import {
  buildServiceBody,
  initialServiceValues,
  MAX_OBSERVATIONS_LENGTH,
  toggleTask,
  validateService,
  type ServiceErrors,
  type ServiceFormValues,
} from '../utils/service'
import { estadoPlanInfo } from '../utils/statusLabels'

interface ServiceFormProps {
  patente: string
  currentKm: number
  /** Tareas del plan de la unidad, ya ordenadas por urgencia. */
  planes: Plan[]
  onSaved: (service: Service) => void
  onCancel: () => void
}

/** Formulario de registro de service (CU09 · RF09): tareas realizadas, fecha, km y observaciones. */
const ServiceForm = ({ patente, currentKm, planes, onSaved, onCancel }: ServiceFormProps) => {
  const tasksErrorId = useId()
  const [today] = useState(todayDateOnly)
  const [values, setValues] = useState<ServiceFormValues>(() => initialServiceValues(currentKm, today))
  const [errors, setErrors] = useState<ServiceErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useRegisterService(patente)

  const change = (field: 'fecha' | 'km' | 'observaciones') => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const toggle = (code: string) => {
    setValues((current) => ({ ...current, tareas: toggleTask(current.tareas, code) }))
    setErrors((current) => ({ ...current, tareas: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateService(values, today)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return

    try {
      onSaved(await mutation.mutateAsync(buildServiceBody(values, today)))
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : 'No se pudo registrar el service.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <fieldset aria-describedby={errors.tareas ? tasksErrorId : undefined} className="space-y-2">
        <legend className="mb-1 text-sm text-muted">Tareas realizadas</legend>
        {planes.map((plan, index) => (
          <label
            key={plan.codigo_tarea}
            className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line px-3 py-2"
          >
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={values.tareas.includes(plan.codigo_tarea)}
              onChange={() => toggle(plan.codigo_tarea)}
              data-autofocus={index === 0 ? true : undefined}
            />
            <span className="flex-1 font-medium">{plan.nombre}</span>
            <StatusBadge status={estadoPlanInfo(plan.estado)} />
          </label>
        ))}
        {errors.tareas && (
          <p id={tasksErrorId} className="text-sm font-semibold text-danger-fg">
            {errors.tareas}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Fecha"
          type="date"
          required
          max={today}
          value={values.fecha}
          onChange={change('fecha')}
          error={errors.fecha}
        />
        <TextField
          label="Kilometraje"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          required
          value={values.km}
          onChange={change('km')}
          hint={`Actual: ${formatKm(currentKm)}. Si es mayor, actualiza el de la unidad.`}
          error={errors.km}
        />
      </div>

      <TextAreaField
        label="Observaciones (opcional)"
        maxLength={MAX_OBSERVATIONS_LENGTH}
        value={values.observaciones}
        onChange={change('observaciones')}
        error={errors.observaciones}
      />

      {serverError && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : 'Registrar service'}
        </Button>
      </div>
    </form>
  )
}

export default ServiceForm
