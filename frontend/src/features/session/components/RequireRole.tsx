import { Link, Outlet } from 'react-router'
import type { Rol } from '../../../api/types'
import Card from '../../../shared/components/ui/Card'
import { useCan } from '../hooks/useCan'

/**
 * Ruta de diseño que deja pasar solo a los usuarios con alguno de estos roles. Para los
 * demás muestra que no tienen permiso. Va dentro de `RequireSession`, que ya garantiza el
 * usuario.
 */
const RequireRole = ({ roles }: { roles: readonly Rol[] }) => {
  const allowed = useCan(...roles)
  if (allowed) return <Outlet />

  return (
    <Card role="alert" className="space-y-2">
      <h1 className="text-xl font-bold">Sin permiso</h1>
      <p>Tu rol no permite ver esta pantalla. Si creés que es un error, pedile acceso a un administrador.</p>
      <p>
        <Link to="/unidades" className="text-accent underline">
          Ir a la flota
        </Link>
      </p>
    </Card>
  )
}

export default RequireRole
