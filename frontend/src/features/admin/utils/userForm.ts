import type { Rol } from '../../../api/types'
import type { User, UserEdit, UserInput } from '../types'
import { ROL_LABEL } from './labels'

/** Mismo formato que valida el servidor: algo@dominio.ext, sin espacios. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const MAX_EMAIL = 100
export const MAX_NOMBRE = 100

/** Lo que el usuario escribe en el formulario de un usuario. */
export interface UserFormValues {
  email: string
  nombre: string
  /** `''` hasta que se elige: el rol define qué puede hacer, no conviene dejar uno por defecto. */
  rol: Rol | ''
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>

const ROLES = Object.keys(ROL_LABEL) as Rol[]

/** Valor admitido por la API, o `''` (sin elegir) si no lo es. */
export const parseRol = (value: string): Rol | '' => ROLES.find((rol) => rol === value) ?? ''

/** El email se guarda sin espacios y en minúsculas, como lo normaliza el servidor al buscarlo. */
export const normalizeEmail = (value: string): string => value.trim().toLowerCase()

export const emptyUserValues = (): UserFormValues => ({ email: '', nombre: '', rol: '' })

export const userToValues = (user: User): UserFormValues => ({
  email: user.email,
  nombre: user.nombre ?? '',
  rol: user.rol,
})

/**
 * Validaciones previas al envío, para avisar sin ir al servidor. El servidor sigue siendo
 * quien decide (email repetido, o quitarle el rol al único administrador).
 */
export const validateUser = (values: UserFormValues, { editing }: { editing: boolean }): UserFormErrors => {
  const errors: UserFormErrors = {}

  if (!editing) {
    const email = normalizeEmail(values.email)
    if (email === '') errors.email = 'Ingresá el email.'
    else if (email.length > MAX_EMAIL) errors.email = `Admite hasta ${MAX_EMAIL} caracteres.`
    else if (!EMAIL_PATTERN.test(email)) errors.email = 'Email inválido.'
  }

  if (values.nombre.trim().length > MAX_NOMBRE) errors.nombre = `Admite hasta ${MAX_NOMBRE} caracteres.`
  if (values.rol === '') errors.rol = 'Elegí el rol.'

  return errors
}

/** Cuerpo del alta. El nombre, si está vacío, no se envía. */
export const buildCreateUserBody = (values: UserFormValues): UserInput => {
  const body: UserInput = { email: normalizeEmail(values.email), rol: values.rol as Rol }
  const nombre = values.nombre.trim()
  if (nombre !== '') body.nombre = nombre
  return body
}

/** Cuerpo de la edición: solo lo que cambió. Un nombre vacío envía un texto vacío, que lo borra. */
export const buildEditUserBody = (values: UserFormValues, original: User): UserEdit => {
  const body: UserEdit = {}
  const nombre = values.nombre.trim()
  if (nombre !== (original.nombre ?? '')) body.nombre = nombre
  if (values.rol !== original.rol) body.rol = values.rol as Rol
  return body
}

export const hasUserChanges = (body: UserEdit): boolean => Object.keys(body).length > 0

/** ¿Este cambio le quita el rol de administrador a quien lo está haciendo? Conviene avisar antes. */
export const removesOwnAdmin = (body: UserEdit, original: User, currentEmail: string | undefined): boolean =>
  currentEmail !== undefined &&
  original.email.toLowerCase() === currentEmail.toLowerCase() &&
  original.rol === 'admin' &&
  body.rol !== undefined &&
  body.rol !== 'admin'
