import { Link, useLocation } from 'react-router'

/** Enlace al historial de la unidad (CU13). Reenvía el estado de navegación, para que al volver siga el destino de origen. */
const HistoryLink = ({ patente }: { patente: string }) => {
  const location = useLocation()

  return (
    <Link
      to={`/unidades/${encodeURIComponent(patente)}/historial`}
      state={location.state}
      className="font-semibold text-accent underline"
    >
      Ver el historial de services y postergaciones
    </Link>
  )
}

export default HistoryLink
