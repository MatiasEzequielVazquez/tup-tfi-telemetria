import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { initSession } from './features/session'
import './css/main.css'

// Conecta la sesión (Supabase Auth, o la simulada en desarrollo) con el cliente HTTP.
initSession()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Sin reintentos automáticos: ante un error la pantalla lo muestra enseguida y ofrece
      // "Reintentar". (Los reintentos de TanStack Query además se pausan mientras la pestaña
      // está oculta, lo que dejaba la pantalla en "Cargando…" sin explicación.)
      retry: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
