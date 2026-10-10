import { Link } from 'react-router'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { returnState } from '../../../shared/navigation/returnTarget'
import { formatDateTime } from '../../../shared/utils/formatDate'
import type { Alerta } from '../types'
import { ALERT_STATUS_INFO, ALERT_TYPE_INFO, REFERENCE_LABEL } from '../utils/labels'

interface AlertItemProps {
  alerta: Alerta
  /** Ruta del detalle de una unidad; la aporta quien compone la app (routes). */
  unitPath: (patente: string) => string
  /** Query string de este listado, para que el detalle pueda volver con los mismos filtros. */
  search: string
  reviewing: boolean
  error: string | null
  onReview: (alerta: Alerta) => void
}

/** Una alerta del listado, con su acción de "Marcar como revisada" si está abierta. */
const AlertItem = ({ alerta, unitPath, search, reviewing, error, onReview }: AlertItemProps) => {
  const isOpen = alerta.estado === 'abierta'
  const reference =
    alerta.origen === 'plan' && alerta.referencia_nombre
      ? `${alerta.referencia_nombre} (${alerta.referencia})`
      : alerta.referencia

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ALERT_TYPE_INFO[alerta.tipo]} />
        <StatusBadge status={ALERT_STATUS_INFO[alerta.estado]} />
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Unidad">
          {alerta.patente ? (
            <Link
              to={unitPath(alerta.patente)}
              state={returnState(`/alertas${search}`, 'alertas')}
              className="font-semibold text-accent underline"
            >
              {alerta.patente}
            </Link>
          ) : (
            <span className="text-muted">Sin unidad asociada</span>
          )}
        </Dato>
        <Dato etiqueta={REFERENCE_LABEL[alerta.origen]}>{reference}</Dato>
        <Dato etiqueta="Generada">{formatDateTime(alerta.fecha_generada)}</Dato>
        {alerta.fecha_revisada && (
          <Dato etiqueta="Revisada">{formatDateTime(alerta.fecha_revisada)}</Dato>
        )}
      </dl>

      {isOpen && (
        <div className="space-y-2">
          <Button
            variant="secondary"
            disabled={reviewing}
            aria-busy={reviewing}
            onClick={() => onReview(alerta)}
          >
            {reviewing ? 'Marcando…' : error ? 'Reintentar' : 'Marcar como revisada'}
          </Button>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger-fg">
              No se pudo marcar como revisada: {error}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

export default AlertItem
