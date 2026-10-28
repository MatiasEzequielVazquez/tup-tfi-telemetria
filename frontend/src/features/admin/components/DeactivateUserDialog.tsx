import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog'
import { useUpdateUser } from '../hooks/useUsers'
import type { User } from '../types'

interface DeactivateUserDialogProps {
  open: boolean
  user: User
  onClose: () => void
  onDone: (user: User) => void
}

/** Confirmación de la baja lógica de un usuario (RF17). Un 409 (único administrador) se muestra tal cual. */
const DeactivateUserDialog = ({ open, user, onClose, onDone }: DeactivateUserDialogProps) => {
  const mutation = useUpdateUser(user.email)
  const name = user.nombre ?? user.email

  return (
    <ConfirmDialog
      open={open}
      title={`Dar de baja a ${name}`}
      confirmLabel="Dar de baja"
      pendingLabel="Dando de baja…"
      failureMessage="No se pudo dar de baja al usuario."
      onConfirm={async () => onDone(await mutation.mutateAsync({ activo: false }))}
      onClose={onClose}
    >
      <p>
        <strong>{name}</strong> deja de poder usar el sistema, aunque tenga sesión iniciada en Supabase: va a ver que
        no está habilitado. Conserva todos sus registros (services, postergaciones y kilometraje).
      </p>
      <p className="text-sm text-muted">Se puede reactivar cuando haga falta.</p>
    </ConfirmDialog>
  )
}

export default DeactivateUserDialog
