import { useState, type FormEvent } from 'react'
import type { CargaKm, FuenteKm } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import TextField from '../../../shared/components/ui/TextField'
import { todayDateOnly } from '../../../shared/utils/formatDate'
import { useLoadMileage } from '../hooks/useLoadMileage'
import { formatKm } from '../../../shared/utils/formatKm'
import {
  buildMileageBody,
  validateMileage,
  type MileageErrors,
  type MileageFormValues,
} from '../utils/mileage'
import { FUENTE_KM_LABEL } from '../utils/statusLabels'

interface MileageFormProps {
  patente: string
  currentKm: number
  currentSource: FuenteKm
  onSaved: (carga: CargaKm) => void
  onCancel: () => void
}

/** Formulario de carga manual de kilometraje (CU11 · RF06): kilometraje y fecha. */
const MileageForm = ({ patente, currentKm, currentSource, onSaved, onCancel }: MileageFormProps) => {
  const [today] = useState(todayDateOnly)
  const [values, setValues] = useState<MileageFormValues>({ km: '', fecha: today })
  const [errors, setErrors] = useState<MileageErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useLoadMileage(patente)

  const change = (field: keyof MileageFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo (RN09).
    const found = validateMileage(values, currentKm, today)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return

    try {
      onSaved(await mutation.mutateAsync(buildMileageBody(values, today)))
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : 'No se pudo guardar el kilometraje.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <TextField
        label="Kilometraje"
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        required
        data-autofocus
        value={values.km}
        onChange={change('km')}
        hint={`Actual: ${formatKm(currentKm)} (${FUENTE_KM_LABEL[currentSource]}).`}
        error={errors.km}
      />
      <TextField
        label="Fecha"
        type="date"
        required
        max={today}
        value={values.fecha}
        onChange={change('fecha')}
        error={errors.fecha}
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
          {mutation.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

export default MileageForm
