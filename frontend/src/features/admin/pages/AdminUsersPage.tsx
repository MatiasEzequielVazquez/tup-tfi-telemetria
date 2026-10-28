// AdminUsersPage.tsx — gestión de usuarios: alta, cambio de rol o nombre, baja y reactivación (CU05 · RF17, RN11),
// ruta /administracion/usuarios. Solo para administradores.
import { useState } from 'react'
import { APP_NAME } from '../../../config/app'
import Button from '../../../shared/components/ui/Button'
import Card from '../../../shared/components/ui/Card'
import ErrorPanel from '../../../shared/components/ui/ErrorPanel'
import LoaderSpinner from '../../../shared/components/ui/LoaderSpinner'
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle'
import { useRetryFailedQueries } from '../../../shared/hooks/useRetryFailedQueries'
import UserFormDialog from '../components/UserFormDialog'
import UserItem from '../components/UserItem'
import { useUsers } from '../hooks/useUsers'

interface AdminUsersPageProps {
  /** Email de quien tiene la sesión iniciada. Lo aporta routes, para no acoplar admin con session. */
  currentEmail?: string
}

const AdminUsersPage = ({ currentEmail }: AdminUsersPageProps) => {
  useDocumentTitle(`Administración de usuarios - ${APP_NAME}`)
  const { data, error, isPending } = useUsers()
  const retry = useRetryFailedQueries()
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const inactive = data?.filter((user) => !user.activo).length ?? 0

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Administración de usuarios</h1>
        <Button
          onClick={() => {
            setNotice(null)
            setCreating(true)
          }}
        >
          Nuevo usuario
        </Button>
      </div>

      {/* Región viva: anuncia el resultado confirmado de la última acción. */}
      <div role="status" aria-live="polite">
        {notice && (
          <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 font-semibold text-ok-fg">
            <span aria-hidden="true">✓</span> {notice}
          </p>
        )}
      </div>

      {isPending && !error && <LoaderSpinner label="Cargando usuarios…" />}

      {error && (
        <ErrorPanel
          title={data ? 'No se pudieron actualizar los usuarios' : 'No se pudieron cargar los usuarios'}
          error={error}
          onRetry={retry}
        />
      )}

      {data && data.length === 0 && (
        <Card>
          <p>No hay usuarios registrados.</p>
        </Card>
      )}

      {data && data.length > 0 && (
        <>
          <p className="mb-3 text-muted">
            {data.length === 1 ? '1 usuario' : `${data.length} usuarios`}
            {inactive > 0 && ` · ${inactive === 1 ? '1 dado de baja' : `${inactive} dados de baja`}`}
          </p>
          <ul className="grid gap-3">
            {data.map((user) => (
              <UserItem key={user.email} user={user} currentEmail={currentEmail} onDone={setNotice} />
            ))}
          </ul>
        </>
      )}

      <UserFormDialog
        open={creating}
        currentEmail={currentEmail}
        onClose={() => setCreating(false)}
        onSaved={(user) => {
          setNotice(`Usuario ${user.nombre ?? user.email} dado de alta.`)
          setCreating(false)
        }}
      />
    </>
  )
}

export default AdminUsersPage
