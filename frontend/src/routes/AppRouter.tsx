import { Navigate, Route, Routes } from 'react-router'
import { APP_NAME } from '../config/app'
import { AlertsPage } from '../features/alerts'
import { FleetPage, UnitDetailPage } from '../features/fleet'
import { SessionBanner, SessionPanel } from '../features/session'
import AppLayout, { type NavItem } from '../shared/components/layout/AppLayout'
import NotFoundPage from './NotFoundPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/unidades', label: 'Flota' },
  { to: '/alertas', label: 'Alertas' },
]

// Las alertas enlazan al detalle de una unidad sin conocer la feature fleet: la ruta se
// les entrega desde acá.
const unitPath = (patente: string) => `/unidades/${encodeURIComponent(patente)}`

/**
 * Rutas de la aplicación y composición de las features dentro del layout. Es el único lugar
 * que conoce a la vez el layout compartido y las features.
 */
export const AppRouter = () => (
  <Routes>
    <Route
      element={
        <AppLayout
          brand={APP_NAME}
          homePath="/unidades"
          navItems={NAV_ITEMS}
          headerEnd={<SessionPanel />}
          notice={<SessionBanner />}
        />
      }
    >
      <Route path="/" element={<Navigate to="/unidades" replace />} />
      <Route path="/unidades" element={<FleetPage />} />
      <Route path="/unidades/:patente" element={<UnitDetailPage />} />
      <Route path="/alertas" element={<AlertsPage unitPath={unitPath} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
)
