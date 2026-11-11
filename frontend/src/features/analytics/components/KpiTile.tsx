import Card from '../../../shared/components/ui/Card'
import type { Kpi } from '../utils/kpis'

/** Un indicador: el número es el gráfico. Cifras proporcionales (no tabulares) por su tamaño. */
const KpiTile = ({ kpi }: { kpi: Kpi }) => (
  <Card>
    <dt className="text-sm text-muted">{kpi.label}</dt>
    <dd className="mt-1 text-3xl font-semibold">{kpi.value}</dd>
    <dd className="mt-1 text-sm text-muted">{kpi.hint}</dd>
  </Card>
)

export default KpiTile
