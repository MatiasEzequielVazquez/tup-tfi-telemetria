import { useSyncExternalStore } from 'react'
import { getAuthSession } from '../services/authSession'

/** Estado de la sesión y las acciones para iniciarla y cerrarla. */
export const useSession = () => {
  const session = getAuthSession()
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)

  return { snapshot, mode: session.mode, signIn: session.signIn, signOut: session.signOut }
}
