import type { ErrorRequestHandler } from 'express';

// Errores con el formato del contrato: { error: { code, message } }.
// Los mensajes se muestran tal cual en el dashboard.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const validacion = (m: string) => new HttpError(400, 'validacion', m);
export const noAutenticado = (m = 'Token inválido o vencido.') => new HttpError(401, 'no_autenticado', m);
export const sinPermiso = (m = 'Esta operación requiere rol admin (RN11).') => new HttpError(403, 'sin_permiso', m);
export const noEncontrado = (m: string) => new HttpError(404, 'no_encontrado', m);
export const conflicto = (m: string) => new HttpError(409, 'conflicto', m);

// Errores de PostgreSQL que son culpa del request, no del servidor. Normalmente las reglas
// se validan antes de escribir; esto cubre carreras entre requests simultáneas
// (por ejemplo, dos vinculaciones del mismo dispositivo al mismo tiempo).
const ERRORES_PG: Record<string, () => HttpError> = {
  '23505': () => conflicto('Ya existe un registro con esos datos.'),
  '23P01': () => conflicto('La operación se superpone con otra vigente (RN02).'),
  '23503': () => conflicto('La operación hace referencia a un dato inexistente o en uso.'),
  '23514': () => validacion('Los datos no cumplen una restricción del esquema.'),
  '22P02': () => validacion('Algún valor tiene un formato inválido.'),
  '22007': () => validacion('Alguna fecha tiene un formato inválido.'),
  '22003': () => validacion('Algún número está fuera de rango.'),
  '22001': () => validacion('Algún texto supera el largo permitido.'),
};

/** Middleware final de Express: todo error termina acá. */
export function manejadorErrores(logger: Pick<Console, 'error'> = console): ErrorRequestHandler {
  return (err, req, res, _next) => {
    let e: unknown = err;
    if (!(e instanceof HttpError)) {
      if (err?.type === 'entity.parse.failed') e = validacion('El body no es un JSON válido.');
      else if (err?.type === 'entity.too.large') e = validacion('El body es demasiado grande.');
      else if (typeof err?.code === 'string' && ERRORES_PG[err.code]) e = ERRORES_PG[err.code]!();
    }
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: { code: e.code, message: e.message } });
      return;
    }
    logger.error(`[api] ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ error: { code: 'error_interno', message: 'Error interno del servidor.' } });
  };
}