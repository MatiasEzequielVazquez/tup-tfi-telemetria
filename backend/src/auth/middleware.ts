import type { RequestHandler } from 'express';
import type { Sql } from '../db.js';
import { HttpError, noAutenticado, sinPermiso } from '../http/errores.js';
import type { UsuarioSesion } from '../types/express.js';
import { AuthNoDisponible, type Verificador } from './verificadores.js';

/**
 * RF01, RNF04: exige un token válido y carga el usuario en req.usuario.
 * Un usuario válido en Supabase Auth pero sin fila en "usuarios" no tiene acceso (RN11).
 */
export function autenticar(sql: Sql, verificar: Verificador): RequestHandler {
  return async (req, _res, next) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    if (!m?.[1]) throw noAutenticado('Falta el header Authorization: Bearer <token>.');

    let email: string | null;
    try {
      email = await verificar(m[1].trim());
    } catch (e) {
      if (!(e instanceof AuthNoDisponible)) throw e;
      console.error('[auth]', e.message);
      throw new HttpError(503, 'auth_no_disponible', 'No se pudo validar la sesión. Intentá de nuevo en unos minutos.');
    }
    if (!email) throw noAutenticado();

    const [usuario] = await sql<UsuarioSesion[]>`
      select email, nombre, rol from usuarios where lower(email) = ${email}`;
    if (!usuario) {
      throw new HttpError(403, 'usuario_no_habilitado', 'Tu usuario no está habilitado en el sistema. Pedile acceso a un administrador.');
    }
    req.usuario = usuario;
    next();
  };
}

/** RN11: operaciones reservadas al administrador. */
export const soloAdmin: RequestHandler = (req, _res, next) => {
  if (req.usuario?.rol !== 'admin') throw sinPermiso();
  next();
};