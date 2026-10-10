import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import type { Plan } from '../types'
import { formatDateTime } from '../../../shared/utils/formatDate'
import { formatKm } from '../utils/format'
import { estadoPlanInfo, MOTIVO_LABEL } from '../utils/statusLabels'

/** Una tarea del plan de mantenimiento, con el estado y los km que calcula la API. */
const PlanItem = ({ plan }: { plan: Plan }) => {
  const postergacion = plan.postergacion_vigente
  const kmRestantes =
    plan.km_restantes < 0
      ? `Excedida por ${formatKm(Math.abs(plan.km_restantes))}`
      : formatKm(plan.km_restantes)

  return (
    <Card as="li">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{plan.nombre}</h3>
        <StatusBadge status={estadoPlanInfo(plan.estado)} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Dato etiqueta="Km restantes">{kmRestantes}</Dato>
        <Dato etiqueta="Límite">{formatKm(plan.km_limite)}</Dato>
        <Dato etiqueta="Intervalo">{formatKm(plan.intervalo_km)}</Dato>
        <Dato etiqueta="Aviso con menos de">{formatKm(plan.umbral_aviso_km)}</Dato>
        <Dato etiqueta="Último service">{formatKm(plan.km_ultimo_service)}</Dato>
      </dl>
      {postergacion && (
        <p className="mt-3 rounded-lg bg-postponed-bg px-3 py-2 text-sm text-postponed-fg">
          <strong>Postergación vigente:</strong> hasta {formatKm(postergacion.km_limite_nuevo)}.
          Motivo: {MOTIVO_LABEL[postergacion.motivo]}
          {postergacion.motivo_descripcion ? ` (${postergacion.motivo_descripcion})` : ''}.
          Registrada el {formatDateTime(postergacion.fecha)} por {postergacion.email_usuario}.
        </p>
      )}
    </Card>
  )
}

export default PlanItem
