import Button from '../../../shared/components/ui/Button'
import SelectField from '../../../shared/components/ui/SelectField'
import type { UnitOption } from '../types'
import {
  STATUS_FILTER_LABELS,
  parseAlertStatus,
  parseAlertType,
  parsePatente,
  type AlertFilters as Filters,
} from '../utils/filters'
import { ALERT_TYPE_INFO } from '../utils/labels'

interface AlertFiltersProps {
  filters: Filters
  /** `undefined` mientras se cargan las unidades. */
  unitOptions: UnitOption[] | undefined
  unitOptionsFailed: boolean
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

const STATUS_OPTIONS = Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => ({ value, label }))
const TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Object.entries(ALERT_TYPE_INFO).map(([value, info]) => ({ value, label: info.label })),
]

/** Filtros del listado de alertas: estado, tipo y unidad. */
const AlertFilters = ({ filters, unitOptions, unitOptionsFailed, onChange, onReset }: AlertFiltersProps) => {
  // Las unidades salen de la API (incluidas las dadas de baja). Si la patente de la URL no
  // está en la lista (o aún no cargó), se la ofrece igual para que el selector la muestre.
  const unitSelectOptions = [
    { value: '', label: 'Todas' },
    ...(unitOptions ?? []).map((unit) => ({
      value: unit.patente,
      label: unit.activa ? unit.patente : `${unit.patente} (dada de baja)`,
    })),
  ]
  if (filters.patente && !unitSelectOptions.some((option) => option.value === filters.patente)) {
    unitSelectOptions.push({ value: filters.patente, label: filters.patente })
  }

  return (
    <form
      aria-label="Filtros de alertas"
      onSubmit={(event) => event.preventDefault()}
      className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <SelectField
        label="Estado"
        value={filters.estado}
        options={STATUS_OPTIONS}
        onChange={(value) => onChange({ estado: parseAlertStatus(value) })}
      />
      <SelectField
        label="Tipo"
        value={filters.tipo ?? ''}
        options={TYPE_OPTIONS}
        onChange={(value) => onChange({ tipo: parseAlertType(value) })}
      />
      <div className="flex flex-col gap-1">
        <SelectField
          label="Unidad"
          value={filters.patente ?? ''}
          options={unitSelectOptions}
          disabled={unitOptions === undefined && !unitOptionsFailed && !filters.patente}
          onChange={(value) => onChange({ patente: parsePatente(value) })}
        />
        {unitOptionsFailed && (
          <p role="status" className="text-sm text-muted">
            No se pudo cargar la lista de unidades.
          </p>
        )}
      </div>
      <Button variant="secondary" onClick={onReset}>
        Restablecer filtros
      </Button>
    </form>
  )
}

export default AlertFilters
