import { Link } from 'react-router'
import { APP_NAME } from '../config/app'
import Card from '../shared/components/ui/Card'
import { useDocumentTitle } from '../shared/hooks/useDocumentTitle'

const NotFoundPage = () => {
  useDocumentTitle(`Página no encontrada - ${APP_NAME}`)

  return (
    <Card role="alert" className="space-y-2">
      <h1 className="text-xl font-bold">Página no encontrada</h1>
      <p>La dirección no corresponde a ninguna pantalla.</p>
      <p>
        <Link to="/unidades" className="text-accent underline">
          Ir a la flota
        </Link>
      </p>
    </Card>
  )
}

export default NotFoundPage
