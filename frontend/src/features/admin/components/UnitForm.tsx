import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import SelectField from '../../../shared/components/ui/SelectField'
import TextField from '../../../shared/components/ui/TextField'
import { useCreateUnit, useUpdateUnit } from '../hooks/useAdminUnits'
import type { AdminUnit, Unit } from '../types'
import { PROTOCOLO_LABEL, TENENCIA_LABEL } from '../utils/labels'
import {
  buildCreateBody,
  buildEditBody,
  emptyUnitValues,
  hasChanges,
  MAX_MARCA,
  MAX_MODELO,
  MAX_TITULAR,
  normalizePatente,
  parseProtocolo,
  parseTenencia,
  unitToValues,
  validateUnit,
  type UnitFormErrors,
  type UnitFormValues,
} from '../utils/unitForm'

const TENENCIA_OPTIONS = [
  { value: '', label: 'Elegí la tenencia' },
  ...Object.entries(TENENCIA_LABEL).map(([value, label]) => ({ value, label })),
]
const PROTOCOLO_OPTIONS = [
  { value: '', label: 'Elegí el protocolo' },
  ...Object.entries(PROTOCOLO_LABEL).map(([value, label]) => ({ value, label })),
]

interface UnitFormProps {
  /** La unidad que se edita; sin ella, el formulario da de alta una nueva. */
  unit?: AdminUnit
  onSaved: (unit: Unit) => void
  onCancel: () => void
}

/** Formulario de alta y edición de una unidad (CU02 · RF02). */
const UnitForm = ({ unit, onSaved, onCancel }: UnitFormProps) => {
  const editing = unit !== undefined
  const [values, setValues] = useState<UnitFormValues>(() => (unit ? unitToValues(unit) : emptyUnitValues()))
  const [errors, setErrors] = useState<UnitFormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const create = useCreateUnit()
  const update = useUpdateUnit(unit?.patente ?? '')
  const pending = create.isPending || update.isPending

  const change = (field: keyof UnitFormValues) => (value: string) => {
    const next = field === 'tenencia' ? parseTenencia(value) : field === 'protocolo' ? parseProtocolo(value) : value
    setValues((current) => ({ ...current, [field]: next }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateUnit(values, { editing, original: unit, currentYear: new Date().getFullYear() })
    setErrors(found)
    setMessage(null)
    if (Object.keys(found).length > 0) return

    try {
      if (unit) {
        const body = buildEditBody(values, unit)
        if (!hasChanges(body)) {
          setMessage('No hay cambios para guardar.')
          return
        }
        onSaved(await update.mutateAsync(body))
      } else {
        onSaved(await create.mutateAsync(buildCreateBody(values)))
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar la unidad.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      {unit ? (
        <p className="text-sm text-muted">
          Patente <strong className="text-fg">{unit.patente}</strong> (no se puede cambiar).
        </p>
      ) : (
        <TextField
          label="Patente"
          required
          data-autofocus
          autoCapitalize="characters"
          autoComplete="off"
          value={values.patente}
          onChange={(value) => change('patente')(normalizePatente(value))}
          hint="De 6 a 10 letras o números, sin espacios."
          error={errors.patente}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Marca"
          required
          data-autofocus={unit ? true : undefined}
          maxLength={MAX_MARCA}
          value={values.marca}
          onChange={change('marca')}
          error={errors.marca}
        />
        <TextField
          label="Modelo (opcional)"
          maxLength={MAX_MODELO}
          value={values.modelo}
          onChange={change('modelo')}
          error={errors.modelo}
        />
        <TextField
          label="Año (opcional)"
          type="number"
          inputMode="numeric"
          step={1}
          value={values.anio}
          onChange={change('anio')}
          error={errors.anio}
        />
        <SelectField
          label="Protocolo"
          required
          value={values.protocolo}
          options={PROTOCOLO_OPTIONS}
          onChange={change('protocolo')}
          error={errors.protocolo}
        />
        <SelectField
          label="Tenencia"
          required
          value={values.tenencia}
          options={TENENCIA_OPTIONS}
          onChange={change('tenencia')}
          error={errors.tenencia}
        />
        {values.tenencia === 'fletero' && (
          <TextField
            label="Titular (opcional)"
            maxLength={MAX_TITULAR}
            value={values.titular}
            onChange={change('titular')}
            hint="Dueño de la unidad."
            error={errors.titular}
          />
        )}
      </div>

      {message && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear unidad'}
        </Button>
      </div>
    </form>
  )
}

export default UnitForm
