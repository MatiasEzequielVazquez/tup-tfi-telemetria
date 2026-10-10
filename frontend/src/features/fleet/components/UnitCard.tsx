import { Link } from 'react-router'
import type { UnidadResumen } from '../../../api/types'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { formatKm } from '../utils/format'
import {
  estadoDispositivoInfo,
  estadoMantenimientoInfo,
  FUENTE_KM_LABEL,
  SIN_DISPOSITIVO,
  TENENCIA_LABEL,
} from '../utils/statusLabels'

const fallasTexto = (cantidad: number): string => {
  if (cantidad === 0) return 'Sin fallas activas'
  return cantidad === 1 ? '1 falla activa' : `${cantidad} fallas activas`
}

/** Tarjeta de una unidad en el listado de la flota; lleva al detalle. */
interface UnitCardProps {
  unidad: UnidadResumen
  /** Estado de navegación para que el detalle pueda volver a este listado. */
  linkState?: unknown
}

const UnitCard = ({ unidad, linkState }: UnitCardProps) => {
  const dispositivo = unidad.dispositivo
  const descripcion = [unidad.marca, unidad.modelo].filter(Boolean).join(' ')

  return (
    <Card
      as="li"
      className="relative space-y-3 hover:border-accent has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
    >
      <div>
        <h2 className="text-lg font-bold">
          {/* El enlace cubre toda la tarjeta (after:inset-0) para que sea fácil de tocar. */}
          <Link
            to={`/unidades/${encodeURIComponent(unidad.patente)}`}
            state={linkState}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {unidad.patente}
          </Link>
        </h2>
        <p className="text-muted">
          {descripcion}
          {unidad.anio !== null && ` · ${unidad.anio}`} · {TENENCIA_LABEL[unidad.tenencia]}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Dato etiqueta="Kilometraje">
          {formatKm(unidad.km_actual)}{' '}
          <span className="text-muted">({FUENTE_KM_LABEL[unidad.km_fuente]})</span>
        </Dato>
        <Dato etiqueta="Mantenimiento">
          <StatusBadge status={estadoMantenimientoInfo(unidad.estado_mantenimiento)} />
        </Dato>
        <Dato etiqueta="Fallas">
          <span className={unidad.fallas_activas > 0 ? 'font-semibold text-danger-fg' : undefined}>
            {fallasTexto(unidad.fallas_activas)}
          </span>
        </Dato>
        <Dato etiqueta="Dispositivo">
          <StatusBadge
            status={dispositivo ? estadoDispositivoInfo(dispositivo.estado) : SIN_DISPOSITIVO}
          />
        </Dato>
      </dl>
    </Card>
  )
}

export default UnitCard
