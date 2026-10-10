import type { Rol } from '../../../api/types'

/**
 * SESIÓN SIMULADA — SOLO DESARROLLO.
 *
 * El mock (mock/server.js) no valida JWT: interpreta el valor del header
 * `Authorization: Bearer <rol>` como el rol del usuario. Este módulo guarda ese rol y lo
 * expone como "token". No es autenticación: cuando exista Supabase Auth se reemplaza esta
 * feature (y la línea que registra el token en src/main.tsx) por la sesión real; el cliente
 * HTTP y las pantallas no cambian.
 *
 * Es un almacén sin React: lo usan el cliente HTTP (vía el proveedor de token) y el hook
 * useDevRole.
 */

export const ROLES_SIMULADOS: readonly Rol[] = ['admin', 'mantenimiento']

const STORAGE_KEY = 'tfi.dev-session.rol'
const ROL_POR_DEFECTO: Rol = 'admin'

const esRol = (value: unknown): value is Rol => ROLES_SIMULADOS.includes(value as Rol)

const leerRolGuardado = (): Rol => {
  try {
    const guardado = window.localStorage.getItem(STORAGE_KEY)
    return esRol(guardado) ? guardado : ROL_POR_DEFECTO
  } catch {
    return ROL_POR_DEFECTO // almacenamiento bloqueado o no disponible
  }
}

let rolActual: Rol = leerRolGuardado()
const listeners = new Set<() => void>()

export const getDevRole = (): Rol => rolActual

/** El mock toma el token como el rol. */
export const getDevAccessToken = (): string => rolActual

export const setDevRole = (rol: Rol): void => {
  if (rol === rolActual) return
  rolActual = rol
  try {
    window.localStorage.setItem(STORAGE_KEY, rol)
  } catch {
    // sin persistencia: la selección vale solo para esta pestaña
  }
  listeners.forEach((listener) => listener())
}

export const subscribeDevRole = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
