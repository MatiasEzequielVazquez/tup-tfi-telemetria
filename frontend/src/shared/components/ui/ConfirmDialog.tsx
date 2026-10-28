import { useState, type ReactNode } from 'react'
import Button from './Button'
import Dialog from './Dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Lo que se le explica a quien confirma: qué cambia y qué se conserva. */
  children: ReactNode
  /** Texto del botón que confirma, por ejemplo "Dar de baja". */
  confirmLabel: string
  /** Texto de ese botón mientras se espera al servidor, por ejemplo "Dando de baja…". */
  pendingLabel: string
  /** Mensaje si falla sin que el error traiga uno propio. */
  failureMessage: string
  /** Hace la acción. Si falla, el mensaje del error se muestra en el diálogo y no se cierra. */
  onConfirm: () => Promise<void>
  onClose: () => void
}

const Body = ({
  children,
  confirmLabel,
  pendingLabel,
  failureMessage,
  onConfirm,
  onClose,
}: Omit<ConfirmDialogProps, 'open' | 'title'>) => {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await onConfirm()
    } catch (cause) {
      // Por ejemplo, un 409 del servidor: se muestra tal cual.
      setError(cause instanceof Error ? cause.message : failureMessage)
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {children}

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-fg">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" data-autofocus onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" disabled={pending} aria-busy={pending} onClick={() => void confirm()}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * Confirmación de una acción que conviene pensar dos veces (una baja). El foco empieza en
 * "Cancelar". Mientras se espera al servidor el botón queda deshabilitado; si la acción falla,
 * el diálogo sigue abierto con el mensaje, y si sale bien quien lo usa lo cierra.
 */
const ConfirmDialog = ({ open, title, onClose, ...body }: ConfirmDialogProps) => (
  <Dialog open={open} title={title} onClose={onClose}>
    <Body {...body} onClose={onClose} />
  </Dialog>
)

export default ConfirmDialog
