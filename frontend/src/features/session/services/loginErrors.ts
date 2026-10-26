/** Error de inicio de sesión con un mensaje apto para mostrar al usuario. */
export class LoginError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'LoginError'
  }
}

const CONNECTION = 'No se pudo conectar con el servicio de autenticación. Verificá tu conexión e intentá de nuevo.'
const UNAVAILABLE = 'El servicio de autenticación no está disponible. Intentá de nuevo en unos minutos.'
const FALLBACK = 'No se pudo iniciar sesión. Intentá de nuevo.'

interface AuthErrorLike {
  name?: unknown
  code?: unknown
  status?: unknown
  message?: unknown
}

/**
 * Traduce el error de Supabase Auth a un mensaje en español. Se reconoce por sus campos
 * (`code`, `status`, `name`) para no depender de las clases de la librería. Las credenciales
 * incorrectas no distinguen entre correo y contraseña, como las del propio servicio.
 */
export const toLoginError = (error: unknown): LoginError => {
  if (error instanceof LoginError) return error
  if (error instanceof TypeError) return new LoginError(CONNECTION, { cause: error })

  const { name, code, status, message } = (typeof error === 'object' && error !== null ? error : {}) as AuthErrorLike

  if (code === 'invalid_credentials' || (status === 400 && /invalid login credentials/i.test(String(message)))) {
    return new LoginError('Correo o contraseña incorrectos.', { cause: error })
  }
  if (code === 'email_not_confirmed') {
    return new LoginError('El correo todavía no fue confirmado.', { cause: error })
  }
  if (code === 'user_banned') {
    return new LoginError('Tu usuario está deshabilitado. Pedile acceso a un administrador.', { cause: error })
  }
  if (code === 'over_request_rate_limit' || status === 429) {
    return new LoginError('Demasiados intentos. Esperá unos minutos e intentá de nuevo.', { cause: error })
  }
  if (name === 'AuthRetryableFetchError' && (status === 0 || status === undefined)) {
    return new LoginError(CONNECTION, { cause: error })
  }
  if (typeof status === 'number' && status >= 500) return new LoginError(UNAVAILABLE, { cause: error })
  return new LoginError(FALLBACK, { cause: error })
}
