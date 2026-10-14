import express, { type RequestHandler } from 'express';
import type { Config } from './config.js';
import type { Sql } from './db.js';
import { HttpError, manejadorErrores, noEncontrado } from './http/errores.js';

export const BASE = '/api/v1';

/** CORS sin dependencias: solo los orígenes de CORS_ORIGIN (o "*"). */
function cors(origenes: string[]): RequestHandler {
  const todos = origenes.includes('*');
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (todos || origenes.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', todos ? '*' : origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}

function registroRequests(): RequestHandler {
  return (req, res, next) => {
    const t0 = Date.now();
    res.on('finish', () => console.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0} ms)`));
    next();
  };
}

// Todos los POST/PATCH del contrato mandan un objeto JSON.
const exigirBodyObjeto: RequestHandler = (req, _res, next) => {
  if (['POST', 'PATCH'].includes(req.method)) {
    req.body ??= {};
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(new HttpError(400, 'validacion', 'El body debe ser un objeto JSON.'));
    }
  }
  next();
};

export interface Dependencias {
  sql: Sql;
  config: Config;
}

export function crearApp({ sql, config }: Dependencias) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  if (config.nodeEnv !== 'test') app.use(registroRequests());
  app.use(cors(config.corsOrigin));
  app.use(express.json({ limit: '100kb' }));
  app.use(exigirBodyObjeto);

  // Salud del servicio, sin autenticación (la usan Docker y el monitoreo).
  app.get('/health', async (_req, res) => {
    try {
      await sql`select 1`;
      res.json({ status: 'ok', db: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', db: 'sin conexión' });
    }
  });

  const api = express.Router();
  // Acá se van a montar la autenticación (paso 3) y las rutas de cada módulo.
  app.use(BASE, api);

  app.use((req, _res, next) => next(noEncontrado(req.path.startsWith(BASE) ? 'Ruta inexistente.' : `Las rutas de la API empiezan con ${BASE}.`)));
  app.use(manejadorErrores());
  return app;
}