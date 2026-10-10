import type { ReactNode } from 'react'
import type { DetalleUnidad } from '../../../api/types'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { formatDate, formatDateTime } from '../../../shared/utils/formatDate'
import { formatKm } from '../utils/format'
import {
  estadoDispositivoInfo,
  FUENTE_KM_LABEL,
  PROTOCOLO_LABEL,
  TENENCIA_LABEL,
} from '../utils/statusLabels'
import FaultItem from './FaultItem'
import PlanItem from './PlanItem'

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id} className="mt-6">
    <h2 id={id} className="mb-2 text-xl font-semibold">
      {title}
    </h2>
    {children}
  </section>
)

const CHIP = 'rounded-full bg-neutral-bg px-2.5 py-0.5 text-sm font-semibold text-neutral-fg'

/** Detalle de una unidad: datos, dispositivo, plan de mantenimiento y fallas activas. */
const UnitDetail = ({ detalle }: { detalle: DetalleUnidad }) => {
  const { unidad, dispositivo, planes, fallas_activas } = detalle

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold">{unidad.patente}</h1>
        <p className="mt-1 flex flex-wrap gap-2">
          <span className={CHIP}>{TENENCIA_LABEL[unidad.tenencia]}</span>
          <span className={CHIP}>{PROTOCOLO_LABEL[unidad.protocolo]}</span>
          {!unidad.activa && (
            <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-sm font-semibold text-danger-fg">
              <span aria-hidden="true">✕</span> Dada de baja
            </span>
          )}
        </p>
      </header>

      <Section id="sec-datos" title="Datos de la unidad">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Marca">{unidad.marca}</Dato>
          <Dato etiqueta="Modelo">{unidad.modelo ?? 'No informado'}</Dato>
          <Dato etiqueta="Año">{unidad.anio ?? 'No informado'}</Dato>
          <Dato etiqueta="Titular">
            {unidad.titular ?? (unidad.tenencia === 'propia' ? 'Unidad propia' : 'No informado')}
          </Dato>
          <Dato etiqueta="Kilometraje">
            {formatKm(unidad.km_actual)}{' '}
            <span className="text-muted">({FUENTE_KM_LABEL[unidad.km_fuente]})</span>
          </Dato>
          <Dato etiqueta="Alta en el sistema">{formatDate(unidad.created_at)}</Dato>
        </dl>
      </Section>

      <Section id="sec-dispositivo" title="Dispositivo">
        {dispositivo ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato etiqueta="Identificador">{dispositivo.device_uid}</Dato>
            <Dato etiqueta="Estado">
              <StatusBadge status={estadoDispositivoInfo(dispositivo.estado)} />
            </Dato>
            <Dato etiqueta="Última comunicación">
              {dispositivo.ultima_comunicacion
                ? formatDateTime(dispositivo.ultima_comunicacion)
                : 'Sin comunicaciones registradas'}
            </Dato>
            <Dato etiqueta="Vinculado desde">{formatDate(dispositivo.desde)}</Dato>
          </dl>
        ) : (
          <Card>
            <p>Esta unidad no tiene un dispositivo vinculado.</p>
          </Card>
        )}
      </Section>

      <Section id="sec-planes" title="Plan de mantenimiento">
        {planes.length === 0 ? (
          <Card>
            <p>Esta unidad no tiene tareas de mantenimiento asignadas.</p>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {planes.map((plan) => (
              <PlanItem key={plan.codigo_tarea} plan={plan} />
            ))}
          </ul>
        )}
      </Section>

      <Section id="sec-fallas" title="Fallas activas">
        {fallas_activas.length === 0 ? (
          <Card>
            <p>Sin fallas activas.</p>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {fallas_activas.map((falla) => (
              <FaultItem key={`${falla.codigo}|${falla.fecha_aparicion}`} falla={falla} />
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

export default UnitDetail
