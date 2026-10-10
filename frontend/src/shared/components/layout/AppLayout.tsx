import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import ErrorBoundary from '../ErrorBoundary'

export interface NavItem {
  to: string
  label: string
}

interface AppLayoutProps {
  /** Nombre de la aplicación, que lleva a `homePath`. */
  brand: string
  homePath: string
  navItems: NavItem[]
  /** Extremo derecho del encabezado (p. ej. la sesión). Lo aporta quien compone la app. */
  headerEnd?: ReactNode
  /** Aviso a todo el ancho debajo del encabezado. */
  notice?: ReactNode
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 py-1 font-medium ${isActive ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`

/**
 * Estructura general: encabezado, navegación y contenido de la ruta activa. No conoce
 * ninguna feature: lo específico llega por props desde routes/AppRouter.
 */
const AppLayout = ({ brand, homePath, navItems, headerEnd, notice }: AppLayoutProps) => {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link to={homePath} className="text-lg font-bold">
              {brand}
            </Link>
            <nav aria-label="Principal" className="flex gap-5">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          {headerEnd}
        </div>
      </header>

      {notice}

      <main id="contenido" className="mx-auto max-w-6xl p-4">
        {/* La key reinicia el límite de errores al navegar a otra pantalla. */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default AppLayout
