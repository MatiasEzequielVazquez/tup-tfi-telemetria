/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API REST, incluido el prefijo de versión. Ej.: http://localhost:3000/api/v1 */
  readonly VITE_API_URL?: string
  /** Origen de la sesión: `dev` (rol simulado) o `supabase` (login real). Ver src/config/auth.ts. */
  readonly VITE_AUTH_MODE?: string
  /** URL del proyecto de Supabase. Obligatoria con `VITE_AUTH_MODE=supabase`. */
  readonly VITE_SUPABASE_URL?: string
  /** Clave anon (pública) del proyecto de Supabase. Obligatoria con `VITE_AUTH_MODE=supabase`. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
