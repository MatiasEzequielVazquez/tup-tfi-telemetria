import type { ReactNode } from 'react'

/** Par etiqueta/valor para listas de descripción (<dl>). */
const Dato = ({ etiqueta, children }: { etiqueta: string; children: ReactNode }) => (
  <div>
    <dt className="text-sm text-muted">{etiqueta}</dt>
    <dd>{children}</dd>
  </div>
)

export default Dato
