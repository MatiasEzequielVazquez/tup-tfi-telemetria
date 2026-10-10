import { useEffect } from 'react'

/** Fija el título de la pestaña mientras la pantalla está montada. */
export const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = title
  }, [title])
}
