import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge, { type StatusInfo } from '../../../shared/components/ui/StatusBadge'
import { formatDate } from '../../../shared/utils/formatDate'
import { useUpdateUser } from '../hooks/useUsers'
import type { User } from '../types'
import { ROL_LABEL } from '../utils/labels'
import { canDeactivateUser } from '../utils/userActions'
import DeactivateUserDialog from './DeactivateUserDialog'
import UserFormDialog from './UserFormDialog'

// El rol y la baja se muestran con texto e ícono además del color.
const ADMIN: StatusInfo = { label: ROL_LABEL.admin, icon: '★', tone: 'postponed' }
const MAINTENANCE: StatusInfo = { label: ROL_LABEL.mantenimiento, icon: '●', tone: 'neutral' }
const DEACTIVATED: StatusInfo = { label: 'Dado de baja', icon: '✕', tone: 'danger' }

interface UserItemProps {
  user: User
  /** Email de quien tiene la sesión iniciada, para marcarlo como "vos". */
  currentEmail?: string
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/** Un usuario del listado, con su rol y sus acciones: editarlo, darlo de baja o reactivarlo. */
const UserItem = ({ user, currentEmail, onDone }: UserItemProps) => {
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [reactivationError, setReactivationError] = useState<string | null>(null)
  const reactivation = useUpdateUser(user.email)
  const isCurrent = currentEmail !== undefined && user.email.toLowerCase() === currentEmail.toLowerCase()
  const name = user.nombre ?? user.email

  const reactivate = async () => {
    if (reactivation.isPending) return
    setReactivationError(null)
    try {
      await reactivation.mutateAsync({ activo: true })
      onDone(`Usuario ${name} reactivado.`)
    } catch (cause) {
      setReactivationError(cause instanceof Error ? cause.message : 'No se pudo reactivar al usuario.')
    }
  }

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            {name}
            {isCurrent && <span className="ml-2 text-sm font-normal text-muted">(vos)</span>}
          </h2>
          {user.nombre && <p className="text-sm text-muted">{user.email}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!user.activo && <StatusBadge status={DEACTIVATED} />}
          <StatusBadge status={user.rol === 'admin' ? ADMIN : MAINTENANCE} />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Dato etiqueta="Rol">{ROL_LABEL[user.rol]}</Dato>
        <Dato etiqueta="Alta en el sistema">{formatDate(user.created_at)}</Dato>
      </dl>

      {!user.activo && (
        <p className="text-sm text-muted">No puede usar el sistema. Conserva sus registros.</p>
      )}

      {reactivationError && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {reactivationError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" aria-label={`Editar a ${name}`} onClick={() => setEditing(true)}>
          Editar
        </Button>
        {canDeactivateUser(user, currentEmail) && (
          <Button variant="secondary" aria-label={`Dar de baja a ${name}`} onClick={() => setDeactivating(true)}>
            Dar de baja
          </Button>
        )}
        {!user.activo && (
          <Button
            variant="secondary"
            aria-label={`Reactivar a ${name}`}
            disabled={reactivation.isPending}
            aria-busy={reactivation.isPending}
            onClick={() => void reactivate()}
          >
            {reactivation.isPending ? 'Reactivando…' : 'Reactivar'}
          </Button>
        )}
      </div>

      <UserFormDialog
        open={editing}
        user={user}
        currentEmail={currentEmail}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          onDone(`Usuario ${saved.nombre ?? saved.email} actualizado.`)
          setEditing(false)
        }}
      />
      <DeactivateUserDialog
        open={deactivating}
        user={user}
        onClose={() => setDeactivating(false)}
        onDone={(saved) => {
          onDone(`Usuario ${saved.nombre ?? saved.email} dado de baja.`)
          setDeactivating(false)
        }}
      />
    </Card>
  )
}

export default UserItem
