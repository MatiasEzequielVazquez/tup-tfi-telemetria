import { useId } from 'react'
import EChart from '../../../shared/components/charts/EChart'
import Card from '../../../shared/components/ui/Card'
import type { ChartSpec } from '../utils/chartSpecs'

interface ChartCardProps {
  spec: ChartSpec
  /** Datos actualizándose: el gráfico anterior se queda, atenuado. */
  refreshing: boolean
}

/**
 * Tarjeta de un gráfico: título, descripción, gráfico y su tabla de datos. La tabla es la
 * vía de lectura que no depende del color, del puntero ni del canvas.
 */
const ChartCard = ({ spec, refreshing }: ChartCardProps) => {
  const titleId = useId()

  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col">
      <h2 id={titleId} className="text-lg font-semibold">
        {spec.title}
      </h2>
      <p className="mb-3 text-sm text-muted">{spec.description}</p>

      {spec.empty ? (
        <p className="py-6 text-muted">{spec.empty}</p>
      ) : (
        <>
          <EChart buildOption={spec.buildOption} height={spec.height} ariaLabel={spec.ariaLabel} dimmed={refreshing} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted hover:text-fg">Ver los datos en una tabla</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">{spec.title}</caption>
                <thead>
                  <tr className="border-b border-line text-muted">
                    {spec.table.columns.map((column) => (
                      <th key={column} scope="col" className="py-1 pr-4 font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {spec.table.rows.map((row) => (
                    <tr key={row[0]} className="border-b border-line last:border-0">
                      <th scope="row" className="py-1 pr-4 font-normal">
                        {row[0]}
                      </th>
                      {row.slice(1).map((cell, index) => (
                        <td key={spec.table.columns[index + 1]} className="py-1 pr-4 tabular-nums">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Card>
  )
}

export default ChartCard
