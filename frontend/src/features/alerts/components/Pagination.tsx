import Button from '../../../shared/components/ui/Button'

interface PaginationProps {
  page: number
  pages: number
  onChange: (page: number) => void
}

/** Controles de página: anterior, siguiente y posición actual. */
const Pagination = ({ page, pages, onChange }: PaginationProps) => (
  <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
