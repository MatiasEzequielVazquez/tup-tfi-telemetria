import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  /** Se llama al cerrar con Esc, con la X o al hacer clic fuera del cuadro. */
  onClose: () => void
  children: ReactNode
}

/**
 * Diálogo modal sobre el elemento nativo `<dialog>`: el navegador resuelve el foco atrapado,
 * Esc y la devolución del foco al elemento que lo abrió. Los hijos se montan solo mientras
 * está abierto, así un formulario siempre empieza limpio. Si algún hijo tiene el atributo
 * `data-autofocus`, recibe el foco al abrirse.
 */
const Dialog = ({ open, title, onClose, children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // El clic sobre el fondo oscuro llega al propio <dialog>; el contenido tiene su propio padding.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-fg backdrop:bg-black/50"
    >
      {open && (
        <div className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 -mt-2 grid size-11 cursor-pointer place-items-center rounded-lg text-xl text-muted hover:text-fg"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export default Dialog
