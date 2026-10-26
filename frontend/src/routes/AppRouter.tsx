import { Navigate, Route, Routes } from 'react-router'
import { APP_NAME } from '../config/app'
import { AdminDevicesPage, AdminLayout, AdminUnitsPage } from '../features/admin'
import { AlertsPage } from '../features/alerts'
import { FleetPage, HistoryPage, UnitDetailPage } from '../features/fleet'
import {
  LOGIN_PATH,
  LoginPage,
  RequireRole,
  RequireSession,
  SessionBanner,
  SessionPanel,
  useCan,
} from '../features/session'
import AppLayout, { type NavItem } from '../shared/components/layout/AppLayout'
import NotFoundPage from './NotFoundPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/unidades', label: 'Flota' },
  { to: '/alertas', label: 'Alertas' },
]

// Solo para administradores (RN11). Activa también con las subrutas (/administracion/...).
const ADMIN_NAV_ITEM: NavItem = { to: '/administracion', label: 'Administración' }

// Las alertas y la administración enlazan al detalle de una unidad sin conocer la feature
// fleet: la ruta se les entrega desde acá.
const unitPath = (patente: string) => `/unidades/${encodeURIComponent(patente)}`

/**
 * Encabezado y estructura de la aplicación. Va dentro de `RequireSession`, así que el usuario
 * ya está cargado y la navegación puede mostrar solo lo que su rol permite.
 */
const AppShell = () => {
  const isAdmin = useCan('admin')

  return (
    <AppLayout
      brand={APP_NAME}
      homePath="/unidades"
      navItems={isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS}
      headerEnd={<SessionPanel />}
      notice={<SessionBanner />}
    />
  )
}

/**
 * Rutas de la aplicación y composición de las features dentro del layout. Es el único lugar
 * que conoce a la vez el layout compartido y las features. Todo, salvo el login, exige sesión.
 */
export const AppRouter = () => (
  <Routes>
    <Route path={LOGIN_PATH} element={<LoginPage />} />
    <Route element={<RequireSession />}>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/unidades" replace />} />
        <Route path="/unidades" element={<FleetPage />} />
        <Route path="/unidades/:patente" element={<UnitDetailPage />} />
        <Route path="/unidades/:patente/historial" element={<HistoryPage />} />
        <Route path="/alertas" element={<AlertsPage unitPath={unitPath} />} />
        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="/administracion" element={<Navigate to="/administracion/unidades" replace />} />
          <Route element={<AdminLayout />}>
            <Route path="/administracion/unidades" element={<AdminUnitsPage unitPath={unitPath} />} />
            <Route path="/administracion/dispositivos" element={<AdminDevicesPage unitPath={unitPath} />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
)
