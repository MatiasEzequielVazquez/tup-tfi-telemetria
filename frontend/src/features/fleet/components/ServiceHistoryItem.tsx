import type { Service } from '../../../api/types'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import { formatDateOnly } from '../../../shared/utils/formatDate'
import { formatKm } from '../utils/format'

/** Un service del historial: día, km, tareas cubiertas, observaciones y quién lo registró. */
const ServiceHistoryItem = ({ service }: { service: Service }) => (
  <Card as="li" className="space-y-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-semibold">{formatDateOnly(service.fecha)}</h3>
      <p className="text-sm text-muted">Registrado por {service.usuario_nombre ?? service.email_usuario}</p>
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Dato etiqueta="Kilometraje">{formatKm(service.km)}</Dato>
      <Dato etiqueta="Tareas cubiertas">
        {service.tareas.length === 0 ? (
          <span className="text-muted">Sin tareas registradas</span>
        ) : (
          <ul className="list-disc pl-5">
            {service.tareas.map((tarea) => (
              <li key={tarea.codigo_tarea}>{tarea.nombre}</li>
            ))}
          </ul>
        )}
      </Dato>
      {service.observaciones && <Dato etiqueta="Observaciones">{service.observaciones}</Dato>}
    </dl>
  </Card>
)

export default ServiceHistoryItem
