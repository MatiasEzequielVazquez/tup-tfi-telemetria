import type { Rol } from '../../../api/types'

/** ¿El rol del usuario está entre los permitidos? Sin rol (usuario aún sin cargar), no. */
export const hasRole = (rol: Rol | undefined, allowed: readonly Rol[]): boolean =>
  rol !== undefined && allowed.includes(rol)
