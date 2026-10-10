import Button from '../../../shared/components/ui/Button'
import SelectField from '../../../shared/components/ui/SelectField'
import {
  STATE_FILTER_LABELS,
  TENENCIA_FILTER_LABELS,
  parseStateFilter,
  parseTenencia,
  type FleetFilters as Filters,
} from '../utils/filters'

interface FleetFiltersProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

const TENENCIA_OPTIONS = [
  { value: '', label: 'Todas' },
  ...Object.entries(TENENCIA_FILTER_LABELS).map(([value, label]) => ({ value, label })),
]
const STATE_OPTIONS = [
  { value: '', label: 'Todos' },
  ...Object.entries(STATE_FILTER_LABELS).map(([value, label]) => ({ value, label })),
]
const SITUATION_OPTIONS = [
  { value: 'activas', label: 'Activas' },
  { value: 'bajas', label: 'Dadas de baja' },
]

/** Filtros del listado de flota. Los valores se validan con el mismo parser que la URL. */
const FleetFilters = ({ filters, onChange, onReset }: FleetFiltersProps) => (
  <form
    aria-label="Filtros de la flota"
    onSubmit={(event) => event.preventDefault()}
    className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
  >
    <SelectField
      label="Tenencia"
      value={filters.tenencia ?? ''}
      options={TENENCIA_OPTIONS}
      onChange={(value) => onChange({ tenencia: parseTenencia(value) })}
    />
    <SelectField
      label="Estado"
      value={filters.estado ?? ''}
      options={STATE_OPTIONS}
      onChange={(value) => onChange({ estado: parseStateFilter(value) })}
    />
    <SelectField
      label="Situación"
      value={filters.activa ? 'activas' : 'bajas'}
      options={SITUATION_OPTIONS}
      onChange={(value) => onChange({ activa: value !== 'bajas' })}
    />
    <Button variant="secondary" onClick={onReset}>
      Limpiar filtros
    </Button>
  </form>
)

export default FleetFilters
