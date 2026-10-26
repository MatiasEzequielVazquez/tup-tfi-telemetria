import { isInternalPath } from '../../../shared/navigation/returnTarget'

export const LOGIN_PATH = '/login'

/** Adónde va el usuario después de iniciar sesión si no venía de una pantalla puntual. */
export const DEFAULT_REDIRECT = '/unidades'

interface RedirectState {
  from: string
}

/** Estado de navegación hacia el login: recuerda la pantalla a la que se quería entrar. */
export const redirectState = (from: string): RedirectState => ({ from })

/** Pantalla a la que volver tras iniciar sesión. Solo rutas internas y nunca el login mismo. */
export const readRedirectPath = (state: unknown): string => {
  if (typeof state !== 'object' || state === null) return DEFAULT_REDIRECT
  const { from } = state as Partial<RedirectState>
  if (typeof from !== 'string' || !isInternalPath(from)) return DEFAULT_REDIRECT
  const pathname = from.split(/[?#]/)[0]
  return pathname === LOGIN_PATH ? DEFAULT_REDIRECT : from
}
