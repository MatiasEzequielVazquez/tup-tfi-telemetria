import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import TextField from '../../../shared/components/ui/TextField'
import { useCreateCatalogTask } from '../hooks/useCatalog'
import type { CatalogTask } from '../types'
import {
  buildCatalogBody,
  emptyCatalogValues,
  MAX_NOMBRE,
  normalizeCodigo,
  validateCatalogTask,
  type CatalogFormErrors,
  type CatalogFormValues,
} from '../utils/catalogForm'

interface CreateCatalogTaskDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (task: CatalogTask) => void
}

const Form = ({ onClose, onCreated }: Omit<CreateCatalogTaskDialogProps, 'open'>) => {
  const [values, setValues] = useState<CatalogFormValues>(emptyCatalogValues)
  const [errors, setErrors] = useState<CatalogFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const mutation = useCreateCatalogTask()

  const change = (field: keyof CatalogFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.isPending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateCatalogTask(values)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return

    try {
      onCreated(await mutation.mutateAsync(buildCatalogBody(values)))
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : 'No se pudo crear la tarea.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <TextField
        label="Nombre"
        required
        data-autofocus
        maxLength={MAX_NOMBRE}
        value={values.nombre}
        onChange={change('nombre')}
        hint="Como se muestra en el plan de cada unidad, por ejemplo Filtro de aire."
        error={errors.nombre}
      />
      <TextField
        label="Código"
        required
        autoComplete="off"
        autoCapitalize="characters"
        value={values.codigo}
        onChange={(value) => change('codigo')(normalizeCodigo(value))}
        hint="Identifica la tarea: mayúsculas, números y guion bajo, por ejemplo FILTRO_AIRE."
        error={errors.codigo}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Intervalo por defecto (km)"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          required
          value={values.intervalo}
          onChange={change('intervalo')}
          hint="Cada cuántos km se hace."
          error={errors.intervalo}
        />
        <TextField
          label="Aviso por defecto (km)"
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
      <p className="text-sm text-muted">
        Son valores por defecto: al asignar la tarea a una unidad se pueden ajustar para esa unidad.
      </p>

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
          {mutation.isPending ? 'Guardando…' : 'Crear tarea'}
        </Button>
      </div>
    </form>
  )
}

/** Alta de un tipo de tarea del catálogo (CU04 · RF07). */
const CreateCatalogTaskDialog = ({ open, onClose, onCreated }: CreateCatalogTaskDialogProps) => (
  <Dialog open={open} title="Nueva tarea del catálogo" onClose={onClose}>
    <Form onClose={onClose} onCreated={onCreated} />
  </Dialog>
)

export default CreateCatalogTaskDialog
