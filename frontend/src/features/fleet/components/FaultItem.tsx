import Card from '../../../shared/components/ui/Card'
import type { Falla } from '../types'
import { formatDateTime } from '../../../shared/utils/formatDate'

/** Una falla activa informada por la unidad. */
const FaultItem = ({ falla }: { falla: Falla }) => (
  <Card as="li">
    <p className="font-semibold">{falla.codigo}</p>
    <p className="text-sm text-muted">Apareció el {formatDateTime(falla.fecha_aparicion)}</p>
  </Card>
)

export default FaultItem
