import { useSession } from '../hooks/useSession'

/** Aviso de que la sesión es simulada. Solo aparece en modo desarrollo (VITE_AUTH_MODE=dev). */
const SessionBanner = () => {
  const { mode } = useSession()
  if (mode !== 'dev') return null

  return (
    <p role="note" className="bg-warn-bg px-4 py-1.5 text-sm text-warn-fg">
      <strong>Modo desarrollo:</strong> la sesión es simulada (VITE_AUTH_MODE=dev).
    </p>
  )
}

export default SessionBanner
