import Button from '../../../shared/components/ui/Button'
import TextField from '../../../shared/components/ui/TextField'
import type { HistoryFilters } from '../utils/history'

interface HistoryPeriodFilterProps {
  filters: HistoryFilters
  /** Mensaje si el período es inconsistente. */
  error: string | null
  onChange: (patch: Partial<HistoryFilters>) => void
  onReset: () => void
}

/** Filtro por período (RF16): fecha inicial y final, inclusivas; cualquiera puede quedar vacía. */
const HistoryPeriodFilter = ({ filters, error, onChange, onReset }: HistoryPeriodFilterProps) => (
  <form
    aria-label="Período del historial"
    onSubmit={(event) => event.preventDefault()}
    className="mb-4 grid grid-cols-1 items-start gap-3 sm:grid-cols-3"
  >
    <TextField
      label="Desde"
      type="date"
      value={filters.desde ?? ''}
      onChange={(value) => onChange({ desde: value || null })}
    />
    <TextField
      label="Hasta"
      type="date"
      value={filters.hasta ?? ''}
      onChange={(value) => onChange({ hasta: value || null })}
      error={error ?? undefined}
    />
    {/* Misma altura que los campos, alineado con ellos aunque haya un error debajo. */}
    <div className="sm:pt-6">
      <Button variant="secondary" className="w-full" onClick={onReset}>
        Limpiar período
      </Button>
    </div>
  </form>
)

export default HistoryPeriodFilter
