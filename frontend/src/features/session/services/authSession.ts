import { GoTrueClient } from '@supabase/auth-js'
import { setAccessTokenProvider, setUnauthorizedHandler } from '../../../api/client'
import { getAuthConfig, type AuthConfig } from '../../../config/auth'
import type { AuthSession } from '../types'
import { createDevSession, createInvalidSession } from './fixedSessions'
import { createSupabaseSession } from './supabaseSession'

/**
 * Cliente de Supabase Auth. Se usa `@supabase/auth-js` (el paquete de autenticación del que
 * `supabase-js` depende) y no `supabase-js` completo: el dashboard solo inicia sesión, y los
 * datos pasan por la API propia. Evita sumar unos 220 kB de Realtime, Storage y PostgREST.
 */
const createAuthClient = (supabaseUrl: string, supabaseAnonKey: string): GoTrueClient =>
  new GoTrueClient({
    url: `${supabaseUrl}/auth/v1`,
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    // Mismo nombre que usa supabase-js, derivado del proyecto.
    storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    // No hay enlaces mágicos ni OAuth: evita leer la URL al cargar.
    detectSessionInUrl: false,
  })

const createSession = (config: AuthConfig): AuthSession => {
  switch (config.mode) {
    case 'dev':
      return createDevSession()
    case 'invalid':
      return createInvalidSession(config.message)
    case 'supabase':
      return createSupabaseSession({
        auth: createAuthClient(config.supabaseUrl, config.supabaseAnonKey),
      })
  }
}

let current: AuthSession | undefined

/** La sesión de la aplicación, según la configuración de entorno. Se crea una sola vez. */
export const getAuthSession = (): AuthSession => (current ??= createSession(getAuthConfig()))

/**
 * Conecta la sesión con el cliente HTTP: de dónde sale el token de cada request y qué hacer
 * cuando la API lo rechaza. Se llama una sola vez al iniciar la aplicación (src/main.tsx).
 */
export const initSession = (): void => {
  const session = getAuthSession()
  setAccessTokenProvider(() => session.getAccessToken())
  setUnauthorizedHandler((token) => session.handleUnauthorized(token))
}
