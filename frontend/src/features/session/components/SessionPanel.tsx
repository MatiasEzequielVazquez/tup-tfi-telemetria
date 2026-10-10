import { useId } from 'react'
import type { Rol } from '../../../api/types'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useDevRole } from '../hooks/useDevRole'
import { ROLES_SIMULADOS } from '../services/devSessionStore'

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  mantenimiento: 'Mantenimiento',
}

/** Usuario actual (GET /me) y selector del rol simulado. Solo para desarrollo. */
const SessionPanel = () => {
  const selectId = useId()
  const { rol, cambiarRol } = useDevRole()
  const { data: usuario, isPending, error } = useCurrentUser()

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <p aria-live="polite">
        {isPending && !error && 'Cargando usuario…'}
        {error && 'Usuario no disponible'}
        {usuario && (
          <>
            <strong>{usuario.nombre ?? usuario.email}</strong>{' '}
            <span className="text-muted">
              {usuario.nombre ? `${usuario.email} · ` : ''}
              {ROL_LABEL[usuario.rol]}
            </span>
          </>
        )}
      </p>
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
    </div>
  )
}

export default SessionPanel
