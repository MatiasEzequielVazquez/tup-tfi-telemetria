/** Indicador de carga con texto (el estado se anuncia a lectores de pantalla). */
const LoaderSpinner = ({ label }: { label: string }) => (
  <p role="status" className="flex items-center gap-2 text-muted">
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
    />
    {label}
  </p>
)

export default LoaderSpinner
