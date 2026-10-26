import type { AuthSession, SessionSnapshot } from '../types'
import { toLoginError } from './loginErrors'

interface SessionLike {
  access_token: string
}

/** Lo que se usa de `supabase.auth`. Con esta forma mínima la sesión se prueba sin la librería. */
export interface SupabaseAuthClient {
  auth: {
    onAuthStateChange(callback: (event: string, session: SessionLike | null) => void): unknown
    getSession(): Promise<{ data: { session: SessionLike | null } }>
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: unknown }>
    signOut(options: { scope: 'local' }): Promise<{ error: unknown }>
  }
}

const LOADING: SessionSnapshot = { status: 'loading' }
const SIGNED_IN: SessionSnapshot = { status: 'signed-in' }
const SIGNED_OUT: SessionSnapshot = { status: 'signed-out' }

/**
 * Sesión respaldada por Supabase Auth. La librería guarda la sesión en el navegador y la
 * renueva sola antes de que venza; acá solo se refleja su estado y se pide el token vigente.
 */
export const createSupabaseSession = (client: SupabaseAuthClient): AuthSession => {
  let snapshot: SessionSnapshot = LOADING
  const listeners = new Set<() => void>()

  const update = (next: SessionSnapshot): void => {
    if (next.status === snapshot.status) return
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  // Incluye el evento INITIAL_SESSION, que resuelve el estado inicial al cargar la página.
  // El callback no hace llamadas a Supabase: la librería lo desaconseja (puede bloquearse).
  client.auth.onAuthStateChange((_event, session) => update(session ? SIGNED_IN : SIGNED_OUT))

  return {
    mode: 'supabase',
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    // getSession devuelve la sesión ya renovada si el token estaba vencido.
    getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,

    signIn: async (email, password) => {
      let result: { error: unknown }
      try {
        result = await client.auth.signInWithPassword({ email, password })
      } catch (cause) {
        throw toLoginError(cause)
      }
      if (result.error) throw toLoginError(result.error)
    },

    signOut: async () => {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw new Error('No se pudo cerrar la sesión. Intentá de nuevo.', { cause: error })
    },

    // Si el token rechazado ya no es el de la sesión (se renovó mientras tanto), no se cierra.
    handleUnauthorized: (token) => {
      void (async () => {
        const { data } = await client.auth.getSession()
        if (data.session?.access_token === token) await client.auth.signOut({ scope: 'local' })
      })().catch(() => {})
    },
  }
}
