import Dialog from '../../../shared/components/ui/Dialog'
import type { User } from '../types'
import UserForm from './UserForm'

interface UserFormDialogProps {
  open: boolean
  /** El usuario que se edita; sin él, el diálogo da de alta uno nuevo. */
  user?: User
  currentEmail?: string
  onClose: () => void
  onSaved: (user: User) => void
}

/** El formulario de un usuario en un diálogo: alta o edición. */
const UserFormDialog = ({ open, user, currentEmail, onClose, onSaved }: UserFormDialogProps) => (
  <Dialog open={open} title={user ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}>
    <UserForm user={user} currentEmail={currentEmail} onCancel={onClose} onSaved={onSaved} />
  </Dialog>
)

export default UserFormDialog
