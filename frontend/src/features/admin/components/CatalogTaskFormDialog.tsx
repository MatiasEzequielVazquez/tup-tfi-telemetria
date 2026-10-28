import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import TextField from '../../../shared/components/ui/TextField'
import { useCreateCatalogTask, useUpdateCatalogTask } from '../hooks/useCatalog'
import type { CatalogTask } from '../types'
import {
  buildCatalogBody,
  buildEditCatalogBody,
  catalogTaskToValues,
  emptyCatalogValues,
  hasCatalogChanges,
  MAX_NOMBRE,
  normalizeCodigo,
  validateCatalogTask,
  type CatalogFormErrors,
  type CatalogFormValues,
} from '../utils/catalogForm'

interface CatalogTaskFormDialogProps {
  open: boolean
  /** La tarea que se edita; sin ella, el diálogo da de alta una nueva. */
  task?: CatalogTask
  onClose: () => void
  onSaved: (task: CatalogTask) => void
}

const Form = ({ task, onClose, onSaved }: Omit<CatalogTaskFormDialogProps, 'open'>) => {
  const editing = task !== undefined
  const [values, setValues] = useState<CatalogFormValues>(() => (task ? catalogTaskToValues(task) : emptyCatalogValues()))
  const [errors, setErrors] = useState<CatalogFormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const create = useCreateCatalogTask()
  const update = useUpdateCatalogTask(task?.codigo ?? '')
  const pending = create.isPending || update.isPending

  const change = (field: keyof CatalogFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateCatalogTask(values, { editing })
    setErrors(found)
    setMessage(null)
    if (Object.keys(found).length > 0) return

    try {
      if (task) {
        const body = buildEditCatalogBody(values, task)
        if (!hasCatalogChanges(body)) {
          setMessage('No hay cambios para guardar.')
          return
        }
        onSaved(await update.mutateAsync(body))
      } else {
        onSaved(await create.mutateAsync(buildCatalogBody(values)))
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar la tarea.')
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
      {task ? (
        <p className="text-sm text-muted">
          Código <strong className="text-fg">{task.codigo}</strong> (no se puede cambiar).
        </p>
      ) : (
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
      )}
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
        {editing
          ? 'Los valores por defecto solo se usan al asignar la tarea a una unidad: los planes que ya la tienen no cambian.'
          : 'Son valores por defecto: al asignar la tarea a una unidad se pueden ajustar para esa unidad.'}
      </p>

      {message && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
      </div>
    </form>
  )
}

/** Alta o edición de una tarea del catálogo (CU04 · RF07). */
const CatalogTaskFormDialog = ({ open, task, onClose, onSaved }: CatalogTaskFormDialogProps) => (
  <Dialog open={open} title={task ? 'Editar tarea del catálogo' : 'Nueva tarea del catálogo'} onClose={onClose}>
    <Form task={task} onClose={onClose} onSaved={onSaved} />
  </Dialog>
)

export default CatalogTaskFormDialog
