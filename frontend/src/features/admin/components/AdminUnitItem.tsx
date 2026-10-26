import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import Dato from '../../../shared/components/ui/Dato'
import type { AdminUnit } from '../types'
import { PROTOCOLO_LABEL, TENENCIA_LABEL } from '../utils/labels'
import DeactivateUnitDialog from './DeactivateUnitDialog'
import UnitFormDialog from './UnitFormDialog'

interface AdminUnitItemProps {
  unit: AdminUnit
  /** Ruta del detalle de la unidad; la aporta quien compone la app (routes). */
  unitPath: (patente: string) => string
  /** Avisa el resultado de una acción, para que la pantalla lo anuncie. */
  onDone: (message: string) => void
}

/** Una unidad del listado de administración, con sus acciones (solo las activas se pueden cambiar). */
const AdminUnitItem = ({ unit, unitPath, onDone }: AdminUnitItemProps) => {
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const description = [unit.marca, unit.modelo].filter(Boolean).join(' ')

  return (
    <Card as="li" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          <Link to={unitPath(unit.patente)} className="text-accent underline">
            {unit.patente}
          </Link>
        </h2>
        {!unit.activa && (
          <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-sm font-semibold text-danger-fg">
            <span aria-hidden="true">✕</span> Dada de baja
          </span>
        )}
      </div>
      <p className="text-muted">
        {description}
        {unit.anio !== null && ` · ${unit.anio}`}
      </p>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Dato etiqueta="Tenencia">
          {TENENCIA_LABEL[unit.tenencia]}
          {unit.titular && <span className="text-muted"> · {unit.titular}</span>}
        </Dato>
        <Dato etiqueta="Protocolo">{PROTOCOLO_LABEL[unit.protocolo]}</Dato>
        <Dato etiqueta="Dispositivo">
          {unit.dispositivo ? unit.dispositivo.device_uid : <span className="text-muted">Sin dispositivo</span>}
        </Dato>
      </dl>

      {unit.activa && (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" aria-label={`Editar ${unit.patente}`} onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="secondary" aria-label={`Dar de baja ${unit.patente}`} onClick={() => setDeactivating(true)}>
            Dar de baja
          </Button>
        </div>
      )}

      <UnitFormDialog
        open={editing}
        unit={unit}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          onDone(`Unidad ${saved.patente} actualizada.`)
          setEditing(false)
        }}
      />
      <DeactivateUnitDialog
        open={deactivating}
        patente={unit.patente}
        onClose={() => setDeactivating(false)}
        onDone={(saved) => {
          onDone(`Unidad ${saved.patente} dada de baja.`)
          setDeactivating(false)
        }}
      />
    </Card>
  )
}

export default AdminUnitItem
