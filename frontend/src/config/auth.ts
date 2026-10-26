/** Configuración de la autenticación (sin dependencias de otras capas). */

export type AuthConfig =
  /** Sesión simulada: el token es el rol. Solo para el mock o un backend con AUTH_MODE=dev. */
  | { mode: 'dev' }
  /** Login real con Supabase Auth. */
  | { mode: 'supabase'; supabaseUrl: string; supabaseAnonKey: string }
  /** La configuración es inválida: la aplicación lo informa en pantalla en lugar de arrancar. */
  | { mode: 'invalid'; message: string }

export interface AuthEnv {
  VITE_AUTH_MODE?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Interpreta las variables de entorno. Sin `VITE_AUTH_MODE`, el desarrollo usa la sesión
 * simulada y el build de producción usa Supabase. La sesión simulada está prohibida en
 * producción, igual que `AUTH_MODE=dev` en el backend.
 */
export const resolveAuthConfig = (env: AuthEnv, isProduction: boolean): AuthConfig => {
  const mode = env.VITE_AUTH_MODE?.trim() || (isProduction ? 'supabase' : 'dev')

  if (mode === 'dev') {
    return isProduction
      ? { mode: 'invalid', message: 'VITE_AUTH_MODE=dev no está permitido en un build de producción.' }
      : { mode: 'dev' }
  }

  if (mode !== 'supabase') {
    return {
      mode: 'invalid',
      message: `VITE_AUTH_MODE debe ser "dev" o "supabase" (vino "${mode}").`,
    }
  }

  const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      mode: 'invalid',
      message:
        'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API).',
    }
  }
  if (!isHttpUrl(supabaseUrl)) {
    return { mode: 'invalid', message: 'VITE_SUPABASE_URL no es una URL válida.' }
  }
  return { mode: 'supabase', supabaseUrl, supabaseAnonKey }
}

export const getAuthConfig = (): AuthConfig => resolveAuthConfig(import.meta.env, import.meta.env.PROD)
