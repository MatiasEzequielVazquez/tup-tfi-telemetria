import { describe, expect, it, vi } from 'vitest'
import { LoginError } from '../../../../../src/features/session/services/loginErrors'
import {
  createSupabaseSession,
  type SupabaseAuthClient,
} from '../../../../../src/features/session/services/supabaseSession'

type Session = { access_token: string } | null

const makeClient = (initial: Session = null) => {
  let stored = initial
  let emit: (event: string, session: Session) => void = () => {}

  const auth = {
    onAuthStateChange: vi.fn((callback: typeof emit) => {
      emit = callback
      return {}
    }),
    getSession: vi.fn(() => Promise.resolve({ data: { session: stored } })),
    signInWithPassword: vi.fn((_credentials: { email: string; password: string }) =>
      Promise.resolve({ error: null as unknown }),
    ),
    signOut: vi.fn((_options: { scope: 'local' }) => Promise.resolve({ error: null as unknown })),
  }
  const client: SupabaseAuthClient = { auth }

  return {
    client,
    auth,
    emit: (event: string, session: Session) => {
      stored = session
      emit(event, session)
    },
  }
}

describe('createSupabaseSession', () => {
  it('arranca cargando y resuelve el estado con el evento inicial de Supabase', () => {
    const { client, emit } = makeClient()
    const session = createSupabaseSession(client)
    expect(session.getSnapshot()).toEqual({ status: 'loading' })

    emit('INITIAL_SESSION', { access_token: 'jwt' })
    expect(session.getSnapshot()).toEqual({ status: 'signed-in' })
  })

  it('queda sin sesión si Supabase no encuentra una guardada', () => {
    const { client, emit } = makeClient()
    const session = createSupabaseSession(client)

    emit('INITIAL_SESSION', null)

    expect(session.getSnapshot()).toEqual({ status: 'signed-out' })
  })

  it('avisa a los suscriptores solo cuando cambia el estado, no en cada renovación del token', () => {
    const { client, emit } = makeClient()
    const session = createSupabaseSession(client)
    const listener = vi.fn()
    session.subscribe(listener)

    emit('INITIAL_SESSION', { access_token: 'a' })
    emit('TOKEN_REFRESHED', { access_token: 'b' })
    emit('SIGNED_OUT', null)

    expect(listener).toHaveBeenCalledTimes(2)
    expect(session.getSnapshot()).toEqual({ status: 'signed-out' })
  })

  it('deja de avisar a quien se desuscribe', () => {
    const { client, emit } = makeClient()
    const session = createSupabaseSession(client)
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)

    unsubscribe()
    emit('SIGNED_IN', { access_token: 'a' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('entrega el token vigente de la sesión, o null sin sesión', async () => {
    const withSession = createSupabaseSession(makeClient({ access_token: 'jwt-vigente' }).client)
    const withoutSession = createSupabaseSession(makeClient().client)

    await expect(withSession.getAccessToken()).resolves.toBe('jwt-vigente')
    await expect(withoutSession.getAccessToken()).resolves.toBeNull()
  })

  describe('signIn', () => {
    it('envía las credenciales a Supabase', async () => {
      const { client, auth } = makeClient()

      await createSupabaseSession(client).signIn('ana@flota.example', 'secreta')

      expect(auth.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
        email: 'ana@flota.example',
        password: 'secreta',
      })
    })

    it('traduce las credenciales inválidas a un mensaje para el usuario', async () => {
      const { client, auth } = makeClient()
      auth.signInWithPassword.mockResolvedValue({
        error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
      })

      const error = await createSupabaseSession(client).signIn('a@b.co', 'mal').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(LoginError)
      expect(error).toMatchObject({ message: 'Correo o contraseña incorrectos.' })
    })

    it('traduce una falla de red', async () => {
      const { client, auth } = makeClient()
      auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))

      const error = await createSupabaseSession(client).signIn('a@b.co', 'x').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(LoginError)
      expect(error).toMatchObject({ message: expect.stringMatching(/conectar/) })
    })
  })

  describe('signOut', () => {
    it('cierra solo la sesión de este navegador', async () => {
      const { client, auth } = makeClient({ access_token: 'jwt' })

      await createSupabaseSession(client).signOut()

      expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' })
    })

    it('informa si Supabase no pudo cerrarla', async () => {
      const { client, auth } = makeClient({ access_token: 'jwt' })
      auth.signOut.mockResolvedValue({ error: new Error('boom') })

      await expect(createSupabaseSession(client).signOut()).rejects.toThrowError(/cerrar la sesión/)
    })
  })

  describe('handleUnauthorized', () => {
    it('cierra la sesión si el token rechazado sigue siendo el vigente', async () => {
      const { client, auth } = makeClient({ access_token: 'jwt-revocado' })

      createSupabaseSession(client).handleUnauthorized('jwt-revocado')

      await vi.waitFor(() => expect(auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' }))
    })

    it('no cierra la sesión si el token ya se renovó (era de una consulta anterior)', async () => {
      const { client, auth } = makeClient({ access_token: 'jwt-nuevo' })

      createSupabaseSession(client).handleUnauthorized('jwt-viejo')

      await vi.waitFor(() => expect(auth.getSession).toHaveBeenCalled())
      expect(auth.signOut).not.toHaveBeenCalled()
    })
  })
})
