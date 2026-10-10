/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API REST, incluido el prefijo de versión. Ej.: http://localhost:3000/api/v1 */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
