/** Aviso de que los datos vienen del mock (todavía no hay backend ni autenticación real). */
const SessionBanner = () => (
  <p role="note" className="bg-warn-bg px-4 py-1.5 text-sm text-warn-fg">
    <strong>Consumiendo datos de mock.</strong>
  </p>
)

export default SessionBanner
