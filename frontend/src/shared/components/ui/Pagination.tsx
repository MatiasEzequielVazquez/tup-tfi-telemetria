import Button from './Button'

interface PaginationProps {
  page: number
  pages: number
  onChange: (page: number) => void
  /** Nombre de la navegación para lectores de pantalla; distinto en cada una si hay varias. */
  label?: string
}

/** Controles de página: anterior, siguiente y posición actual. Los usan los listados paginados. */
const Pagination = ({ page, pages, onChange, label = 'Paginación' }: PaginationProps) => (
  <nav aria-label={label} className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
      ← Anterior
    </Button>
    <p aria-live="polite" className="text-muted">
      Página {page} de {pages}
    </p>
    <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
      Siguiente →
    </Button>
  </nav>
)

export default Pagination
