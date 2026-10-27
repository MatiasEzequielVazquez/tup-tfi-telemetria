import { useState } from 'react'
import type { DetalleUnidad } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import type { Plan } from '../types'
import { formatKm } from '../../../shared/utils/formatKm'
import { canPostpone } from '../utils/postpone'
import PostponeForm from './PostponeForm'

interface PostponeActionProps {
  plan: Plan
  unidad: DetalleUnidad['unidad']
}

/**
 * "Postergar" (CU10) en una tarea del plan: el botón, el formulario en un diálogo y el aviso
 * del resultado. Siempre está montado: al confirmar, la tarea pasa a postergada y el botón
 * deja de ofrecerse, pero el aviso tiene que seguir visible.
 */
const PostponeAction = ({ plan, unidad }: PostponeActionProps) => {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const eligible = canPostpone(unidad.activa, plan.estado)

  return (
    <div className={eligible || notice ? 'mt-3 space-y-2' : undefined}>
      {/* Región viva: anuncia el resultado confirmado de la última postergación. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {eligible && (
        <Button
          variant="secondary"
          aria-label={`Postergar ${plan.nombre}`}
          onClick={() => {
            setNotice(null)
            setOpen(true)
          }}
        >
          Postergar
        </Button>
      )}

      <Dialog open={open} title={`Postergar: ${plan.nombre}`} onClose={() => setOpen(false)}>
        <PostponeForm
          patente={unidad.patente}
          plan={plan}
          currentKm={unidad.km_actual}
          onCancel={() => setOpen(false)}
          onSaved={(postergacion) => {
            setNotice(`Tarea postergada hasta ${formatKm(postergacion.km_limite_nuevo)}.`)
            setOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}

export default PostponeAction
