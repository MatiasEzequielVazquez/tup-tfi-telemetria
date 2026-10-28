import type { User } from '../types'

/**
 * ¿Se ofrece "Dar de baja" para este usuario? Solo a los activos, y nunca a quien tiene la
 * sesión iniciada: el servidor rechaza que un administrador se dé de baja a sí mismo (409), así
 * que no se ofrece una acción que no puede completarse. Tampoco se ofrece sin saber quién es
 * quien opera.
 */
export const canDeactivateUser = (user: User, currentEmail: string | undefined): boolean =>
  user.activo && currentEmail !== undefined && user.email.toLowerCase() !== currentEmail.toLowerCase()
