import Dialog from '../../../shared/components/ui/Dialog'
import type { AdminUnit, Unit } from '../types'
import UnitForm from './UnitForm'

interface UnitFormDialogProps {
  open: boolean
  /** La unidad que se edita; sin ella, el diálogo da de alta una nueva. */
  unit?: AdminUnit
  onClose: () => void
  onSaved: (unit: Unit) => void
}

/** El formulario de una unidad en un diálogo: alta o edición. */
const UnitFormDialog = ({ open, unit, onClose, onSaved }: UnitFormDialogProps) => (
  <Dialog open={open} title={unit ? `Editar la unidad ${unit.patente}` : 'Nueva unidad'} onClose={onClose}>
    <UnitForm unit={unit} onCancel={onClose} onSaved={onSaved} />
  </Dialog>
)

export default UnitFormDialog
