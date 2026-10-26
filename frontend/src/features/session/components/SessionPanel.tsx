import { useId, useState } from 'react'
import type { Rol } from '../../../api/types'
import Button from '../../../shared/components/ui/Button'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDevRole } from '../hooks/useDevRole'
import { useSession } from '../hooks/useSession'
import { ROLES_SIMULADOS } from '../services/devSessionStore'

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  mantenimiento: 'Mantenimiento',
}

/**
 * Usuario actual (GET /me) y, según el modo: "Cerrar sesión" con Supabase, o el selector del
 * rol simulado en desarrollo.
 */
const SessionPanel = () => {
  const selectId = useId()
  const { rol, cambiarRol } = useDevRole()
  const { data: usuario } = useCurrentUser()
  const { mode, signOut } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setSignOutError(null)
    setSigningOut(true)
    try {
      await signOut()
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.')
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {usuario && (
        <p>
          <strong>{usuario.nombre ?? usuario.email}</strong>{' '}
          <span className="text-muted">
            {usuario.nombre ? `${usuario.email} · ` : ''}
            {ROL_LABEL[usuario.rol]}
          </span>
        </p>
      )}

      {mode === 'dev' && (
        <div className="flex items-center gap-2">
          <label htmlFor={selectId}>Rol simulado</label>
          <select
            id={selectId}
            value={rol}
            onChange={(event) => cambiarRol(event.target.value as Rol)}
            className="min-h-9 rounded-lg border border-muted bg-surface px-2 text-fg"
          >
            {ROLES_SIMULADOS.map((valor) => (
              <option key={valor} value={valor}>
                {ROL_LABEL[valor]}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'supabase' && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-9 px-3"
            disabled={signingOut}
            aria-busy={signingOut}
            onClick={() => void handleSignOut()}
          >
            {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </Button>
          {signOutError && (
            <p role="alert" className="font-semibold text-danger-fg">
              {signOutError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default SessionPanel
