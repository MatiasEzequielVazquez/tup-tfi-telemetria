import type { Postergacion } from '../../../api/types'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge, { type StatusInfo } from '../../../shared/components/ui/StatusBadge'
import { formatDateTime } from '../../../shared/utils/formatDate'
import { formatKm } from '../../../shared/utils/formatKm'
import { MOTIVO_LABEL } from '../utils/statusLabels'

// `cerrada` es true cuando un service posterior cubrió la tarea (RN06).
const CLOSED: StatusInfo = { label: 'Cerrada por un service', icon: '✓', tone: 'neutral' }
const OPEN: StatusInfo = { label: 'Abierta', icon: '❚❚', tone: 'postponed' }

/** Una postergación del historial: tarea, motivo, nuevo límite, quién y cuándo, y si ya se cerró. */
const PostponementHistoryItem = ({ postergacion }: { postergacion: Postergacion }) => (
  <Card as="li" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{postergacion.tarea_nombre}</h3>
      <StatusBadge status={postergacion.cerrada ? CLOSED : OPEN} />
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Dato etiqueta="Fecha">{formatDateTime(postergacion.fecha)}</Dato>
      <Dato etiqueta="Nuevo límite">{formatKm(postergacion.km_limite_nuevo)}</Dato>
      <Dato etiqueta="Motivo">
        {MOTIVO_LABEL[postergacion.motivo]}
        {postergacion.motivo_descripcion ? ` — ${postergacion.motivo_descripcion}` : ''}
      </Dato>
      <Dato etiqueta="Registrada por">{postergacion.usuario_nombre ?? postergacion.email_usuario}</Dato>
    </dl>
  </Card>
)

export default PostponementHistoryItem
