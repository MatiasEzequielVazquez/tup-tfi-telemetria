import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { exigirEnum, param, query } from '../../http/validacion.js';
import { obtenerUnidad } from '../unidades/repositorio.js';
import { listarFallas } from './repositorio.js';

const ESTADOS_FALLA = ['activo', 'inactivo'] as const;

export function rutasFallas({ sql }: Dependencias) {
  const r = Router();

  r.get('/unidades/:patente/fallas', async (req, res) => {
    const u = await obtenerUnidad(sql, param(req.params.patente));
    const q = query(req.query.estado);
    let estado: (typeof ESTADOS_FALLA)[number] | undefined;
    if (q) {
      exigirEnum('estado', q, ESTADOS_FALLA);
      estado = q; // acá TS ya sabe que q es 'activo' | 'inactivo'
    }
    res.json({ data: await listarFallas(sql, u.patente, estado) });
  });

  return r;
}