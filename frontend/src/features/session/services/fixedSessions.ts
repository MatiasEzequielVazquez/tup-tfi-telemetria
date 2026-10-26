import type { AuthSession, SessionSnapshot } from '../types'
import { getDevAccessToken } from './devSessionStore'
import { LoginError } from './loginErrors'

// Sesiones cuyo estado no cambia nunca: la simulada de desarrollo y la de una configuración
// inválida. Comparten la forma de `AuthSession` para que el resto de la feature no distinga.

const noop = (): void => {}
const unsubscribe = (): (() => void) => noop

const SIGNED_IN: SessionSnapshot = { status: 'signed-in' }

/** Sesión simulada: siempre iniciada, y el token es el rol (ver devSessionStore). */
export const createDevSession = (): AuthSession => ({
  mode: 'dev',
  getSnapshot: () => SIGNED_IN,
  subscribe: unsubscribe,
  getAccessToken: getDevAccessToken,
  signIn: () => Promise.reject(new LoginError('El inicio de sesión no está disponible en modo desarrollo.')),
  signOut: () => Promise.resolve(),
  handleUnauthorized: noop,
})

/** No hay sesión posible: la aplicación muestra `message` en lugar de arrancar. */
export const createInvalidSession = (message: string): AuthSession => {
  const snapshot: SessionSnapshot = { status: 'misconfigured', message }
  return {
    mode: 'invalid',
    getSnapshot: () => snapshot,
    subscribe: unsubscribe,
    getAccessToken: () => null,
    signIn: () => Promise.reject(new LoginError(message)),
    signOut: () => Promise.resolve(),
    handleUnauthorized: noop,
  }
}
