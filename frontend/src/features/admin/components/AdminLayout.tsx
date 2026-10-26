import { NavLink, Outlet } from 'react-router'

const SECTIONS = [
  { to: '/administracion/unidades', label: 'Unidades' },
  { to: '/administracion/dispositivos', label: 'Dispositivos' },
  { to: '/administracion/catalogo', label: 'Catálogo' },
  { to: '/administracion/usuarios', label: 'Usuarios' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 py-1 font-medium ${isActive ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`

/** Estructura de la administración: la navegación entre sus secciones y la sección activa. */
const AdminLayout = () => (
  <>
    <nav aria-label="Administración" className="mb-4 flex gap-5 border-b border-line">
      {SECTIONS.map((section) => (
        <NavLink key={section.to} to={section.to} className={linkClass}>
          {section.label}
        </NavLink>
      ))}
    </nav>
    <Outlet />
  </>
)

export default AdminLayout
