import type { Rol } from '../../../api/types'
import { hasRole } from '../utils/roles'
import { useCurrentUser } from './useCurrentUser'

/**
 * ¿El usuario actual tiene alguno de estos roles? Sirve para mostrar u ocultar lo que cada rol
 * puede usar (RN11). Es solo de presentación: el que decide es el servidor, que responde 403 a
 * una operación que el rol no puede hacer.
 */
export const useCan = (...roles: Rol[]): boolean => hasRole(useCurrentUser().data?.rol, roles)
