import type { ReactNode } from 'react'

/** Pantalla completa y centrada, para lo que ocurre antes de entrar a la aplicación. */
const SessionScreen = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-4">{children}</main>
)

export default SessionScreen
