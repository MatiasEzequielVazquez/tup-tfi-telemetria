import { describe, expect, it } from 'vitest'
import { LoginError, toLoginError } from '../../../../../src/features/session/services/loginErrors'

describe('toLoginError', () => {
  it.each([
    ['credenciales inválidas', { code: 'invalid_credentials', status: 400 }, 'Correo o contraseña incorrectos.'],
    [
      'credenciales inválidas sin código (versiones anteriores)',
      { status: 400, message: 'Invalid login credentials' },
      'Correo o contraseña incorrectos.',
    ],
    ['correo sin confirmar', { code: 'email_not_confirmed', status: 400 }, 'El correo todavía no fue confirmado.'],
    [
      'usuario deshabilitado',
      { code: 'user_banned', status: 400 },
      'Tu usuario está deshabilitado. Pedile acceso a un administrador.',
    ],
    [
      'demasiados intentos',
      { code: 'over_request_rate_limit', status: 429 },
      'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
    ],
  ])('traduce %s', (_caso, error, mensaje) => {
    expect(toLoginError(error).message).toBe(mensaje)
  })

  it('distingue la falta de conexión de la caída del servicio', () => {
    expect(toLoginError(new TypeError('Failed to fetch')).message).toMatch(/conectar/)
    expect(toLoginError({ name: 'AuthRetryableFetchError', status: 0 }).message).toMatch(/conectar/)
    expect(toLoginError({ name: 'AuthApiError', status: 503 }).message).toMatch(/no está disponible/)
  })

  it('usa un mensaje genérico para lo desconocido, conservando la causa', () => {
    const cause = { status: 400, code: 'otra_cosa' }
    const error = toLoginError(cause)

    expect(error.message).toBe('No se pudo iniciar sesión. Intentá de nuevo.')
    expect(error.cause).toBe(cause)
    expect(toLoginError(undefined).message).toBe(error.message)
  })

  it('no vuelve a envolver un LoginError', () => {
    const original = new LoginError('ya traducido')
    expect(toLoginError(original)).toBe(original)
  })
})
