import { useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import SelectField from '../../../shared/components/ui/SelectField'
import TextField from '../../../shared/components/ui/TextField'
import { useCreateUser, useUpdateUser } from '../hooks/useUsers'
import type { User } from '../types'
import { ROL_LABEL } from '../utils/labels'
import {
  buildCreateUserBody,
  buildEditUserBody,
  emptyUserValues,
  hasUserChanges,
  MAX_EMAIL,
  MAX_NOMBRE,
  parseRol,
  removesOwnAdmin,
  userToValues,
  validateUser,
  type UserFormErrors,
  type UserFormValues,
} from '../utils/userForm'

const ROL_OPTIONS = [
  { value: '', label: 'Elegí el rol' },
  ...Object.entries(ROL_LABEL).map(([value, label]) => ({ value, label })),
]

interface UserFormProps {
  /** El usuario que se edita; sin él, el formulario da de alta uno nuevo. */
  user?: User
  /** Email del usuario que tiene la sesión iniciada, para avisar si se quita su propio rol de admin. */
  currentEmail?: string
  onSaved: (user: User) => void
  onCancel: () => void
}

/** Formulario de alta y edición de un usuario (CU05 · RF17, RN11). */
const UserForm = ({ user, currentEmail, onSaved, onCancel }: UserFormProps) => {
  const editing = user !== undefined
  const [values, setValues] = useState<UserFormValues>(() => (user ? userToValues(user) : emptyUserValues()))
  const [errors, setErrors] = useState<UserFormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const create = useCreateUser()
  const update = useUpdateUser(user?.email ?? '')
  const pending = create.isPending || update.isPending

  const change = (field: keyof UserFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: field === 'rol' ? parseRol(value) : value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  // Quitarse el rol de administrador a uno mismo es válido, pero hace perder el acceso a esta pantalla.
  const losesAccess = user !== undefined && removesOwnAdmin(buildEditUserBody(values, user), user, currentEmail)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return

    // La validación es del lado del cliente para avisar rápido; el servidor sigue decidiendo.
    const found = validateUser(values, { editing })
    setErrors(found)
    setMessage(null)
    if (Object.keys(found).length > 0) return

    try {
      if (user) {
        const body = buildEditUserBody(values, user)
        if (!hasUserChanges(body)) {
          setMessage('No hay cambios para guardar.')
          return
        }
        onSaved(await update.mutateAsync(body))
      } else {
        onSaved(await create.mutateAsync(buildCreateUserBody(values)))
      }
    } catch (cause) {
      // Por ejemplo, un 409 si el usuario ya existe o si se le quita el rol al único administrador.
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar el usuario.')
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      {user ? (
        <p className="text-sm text-muted">
          Email <strong className="text-fg">{user.email}</strong> (no se puede cambiar).
        </p>
      ) : (
        <TextField
          label="Email"
          type="email"
          required
          data-autofocus
          autoComplete="off"
          maxLength={MAX_EMAIL}
          value={values.email}
          onChange={change('email')}
          hint="El mismo con el que inicia sesión."
          error={errors.email}
        />
      )}

      <TextField
        label="Nombre (opcional)"
        data-autofocus={user ? true : undefined}
        maxLength={MAX_NOMBRE}
        value={values.nombre}
        onChange={change('nombre')}
        error={errors.nombre}
      />
      <SelectField
        label="Rol"
        required
        value={values.rol}
        options={ROL_OPTIONS}
        onChange={change('rol')}
        error={errors.rol}
      />
      <p className="text-sm text-muted">
        El administrador gestiona unidades, dispositivos, tareas y usuarios. Mantenimiento registra services,
        postergaciones y kilometraje.
      </p>

      {!user && (
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">
          <strong>Antes de darlo de alta,</strong> el usuario tiene que existir en Supabase (Authentication → Users).
          Acá solo se le asigna el rol: sin una cuenta allí no puede iniciar sesión.
        </p>
      )}

      {losesAccess && (
        <p role="status" className="rounded-lg bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-fg">
          Vas a quitarte el rol de administrador: dejarás de ver la administración.
        </p>
      )}

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
          {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Dar de alta'}
        </Button>
      </div>
    </form>
  )
}

export default UserForm
