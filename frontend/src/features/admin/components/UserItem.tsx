import { useState } from 'react'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge, { type StatusInfo } from '../../../shared/components/ui/StatusBadge'
import { formatDate } from '../../../shared/utils/formatDate'
import type { User } from '../types'
import { ROL_LABEL } from '../utils/labels'
import UserFormDialog from './UserFormDialog'

// El rol se muestra con texto e ícono además del color.
const ADMIN: StatusInfo = { label: ROL_LABEL.admin, icon: '★', tone: 'postponed' }
const MAINTENANCE: StatusInfo = { label: ROL_LABEL.mantenimiento, icon: '●', tone: 'neutral' }

interface UserItemProps {
  user: User
  /** Email de quien tiene la sesión iniciada, para marcarlo como "vos". */
  currentEmail?: string
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/** Un usuario del listado, con su rol y la acción de editarlo. */
const UserItem = ({ user, currentEmail, onDone }: UserItemProps) => {
  const [editing, setEditing] = useState(false)
  const isCurrent = currentEmail !== undefined && user.email.toLowerCase() === currentEmail.toLowerCase()

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            {user.nombre ?? user.email}
            {isCurrent && <span className="ml-2 text-sm font-normal text-muted">(vos)</span>}
          </h2>
          {user.nombre && <p className="text-sm text-muted">{user.email}</p>}
        </div>
        <StatusBadge status={user.rol === 'admin' ? ADMIN : MAINTENANCE} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Dato etiqueta="Rol">{ROL_LABEL[user.rol]}</Dato>
        <Dato etiqueta="Alta en el sistema">{formatDate(user.created_at)}</Dato>
      </dl>

      <Button variant="secondary" aria-label={`Editar a ${user.nombre ?? user.email}`} onClick={() => setEditing(true)}>
        Editar
      </Button>

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
    </Card>
  )
}

export default UserItem
