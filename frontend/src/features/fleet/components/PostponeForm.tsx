import { useState, type FormEvent } from 'react'
import type { Postergacion } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import SelectField from '../../../shared/components/ui/SelectField'
import TextField from '../../../shared/components/ui/TextField'
import { usePostponeTask } from '../hooks/usePostponeTask'
import type { Plan } from '../types'
import { formatKm } from '../../../shared/utils/formatKm'
import {
  buildPostponeBody,
  MAX_DESCRIPTION_LENGTH,
  parseMotivo,
  SUGGESTED_EXTENSION_KM,
  suggestedLimit,
  validatePostpone,
  type PostponeErrors,
  type PostponeFormValues,
} from '../utils/postpone'
import { MOTIVO_LABEL } from '../utils/statusLabels'

const MOTIVO_OPTIONS = [
  { value: '', label: 'Elegí un motivo' },
  ...Object.entries(MOTIVO_LABEL).map(([value, label]) => ({ value, label })),
]

interface PostponeFormProps {
  patente: string
  plan: Plan
  currentKm: number
  onSaved: (postergacion: Postergacion) => void
  onCancel: () => void
}

/** Formulario de postergación de una tarea (CU10 · RF10): motivo y nuevo límite en km. */
const PostponeForm = ({ patente, plan, currentKm, onSaved, onCancel }: PostponeFormProps) => {
  const [values, setValues] = useState<PostponeFormValues>({
    motivo: '',
    descripcion: '',
    limite: String(suggestedLimit(currentKm)),
  })
  const [errors, setErrors] = useState<PostponeErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = usePostponeTask(patente, plan.codigo_tarea)

  const change = (field: keyof PostponeFormValues) => (value: string) => {
    setValues((current) => ({
      ...current,
      [field]: field === 'motivo' ? parseMotivo(value) : value,
    }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo (RN07).
    const found = validatePostpone(values, currentKm)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return

    try {
      onSaved(await mutation.mutateAsync(buildPostponeBody(values)))
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : 'No se pudo postergar la tarea.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <p className="text-sm text-muted">
        Unidad {patente} · Km actual: {formatKm(currentKm)} · Límite actual: {formatKm(plan.km_limite)}
      </p>

      <SelectField
        label="Motivo"
        data-autofocus
        required
        value={values.motivo}
        options={MOTIVO_OPTIONS}
        onChange={change('motivo')}
        error={errors.motivo}
      />
      {values.motivo === 'otro' && (
        <TextField
          label="Descripción del motivo"
          required
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={values.descripcion}
          onChange={change('descripcion')}
          error={errors.descripcion}
        />
      )}
      <TextField
        label="Nuevo límite (km)"
        type="number"
        inputMode="numeric"
        step={1}
        min={0}
        required
        value={values.limite}
        onChange={change('limite')}
        hint={`Se propone una semana más de operación (+${formatKm(SUGGESTED_EXTENSION_KM)}).`}
        error={errors.limite}
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
          {mutation.isPending ? 'Guardando…' : 'Postergar tarea'}
        </Button>
      </div>
    </form>
  )
}

export default PostponeForm
