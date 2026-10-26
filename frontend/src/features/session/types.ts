import type { AuthConfig } from '../../config/auth'

export type SessionSnapshot =
  /** Todavía no se sabe si hay una sesión guardada. */
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in' }
  /** La configuración de autenticación es inválida (ver `config/auth.ts`). */
  | { status: 'misconfigured'; message: string }

/**
 * Lo que el resto de la feature necesita de una sesión, sin saber si es simulada o de
 * Supabase. Es un almacén sin React (se lee con `useSyncExternalStore`).
 */
export interface AuthSession {
  readonly mode: AuthConfig['mode']
  getSnapshot(): SessionSnapshot
  subscribe(listener: () => void): () => void
  /** Token para el header Authorization; `null` si no hay sesión. */
  getAccessToken(): string | null | Promise<string | null>
  /** Inicia sesión con correo y contraseña. Falla con un `LoginError` apto para mostrar. */
  signIn(email: string, password: string): Promise<void>
  /** Cierra la sesión de este navegador. */
  signOut(): Promise<void>
  /** La API rechazó `token` (401): si sigue siendo el de la sesión, se cierra. */
  handleUnauthorized(token: string): void
}
