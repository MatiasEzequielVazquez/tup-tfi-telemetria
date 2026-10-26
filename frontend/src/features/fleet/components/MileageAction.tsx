import { useState } from 'react'
import type { DetalleUnidad } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import Dialog from '../../../shared/components/ui/Dialog'
import { formatKm } from '../../../shared/utils/formatKm'
import { canLoadMileage } from '../utils/mileage'
import MileageForm from './MileageForm'

interface MileageActionProps {
  unidad: DetalleUnidad['unidad']
  dispositivo: DetalleUnidad['dispositivo']
}

/**
 * "Cargar kilometraje" (CU11) en el detalle de la unidad: el botón, el formulario en un
 * diálogo y el aviso del resultado. Con un dispositivo activo no se ofrece la carga: el
 * kilometraje lo informa el dispositivo (RF06).
 */
const MileageAction = ({ unidad, dispositivo }: MileageActionProps) => {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!unidad.activa) return null

  return (
    <div className="mt-3 space-y-2">
      {/* Región viva: anuncia el resultado confirmado de la última carga. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {canLoadMileage(unidad.activa, dispositivo) ? (
        <Button
          variant="secondary"
          onClick={() => {
            setNotice(null)
            setOpen(true)
          }}
        >
          Cargar kilometraje
        </Button>
      ) : (
        <p className="text-sm text-muted">El kilometraje de esta unidad lo informa su dispositivo.</p>
      )}

      <Dialog open={open} title={`Cargar kilometraje de ${unidad.patente}`} onClose={() => setOpen(false)}>
        <MileageForm
          patente={unidad.patente}
          currentKm={unidad.km_actual}
          currentSource={unidad.km_fuente}
          onCancel={() => setOpen(false)}
          onSaved={(carga) => {
            setNotice(`Kilometraje actualizado a ${formatKm(carga.km)}.`)
            setOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}

export default MileageAction
