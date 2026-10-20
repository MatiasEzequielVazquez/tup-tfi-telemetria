import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { soloAdmin } from '../../auth/middleware.js';
import { transaccion } from '../../db.js';
import { conflicto, validacion } from '../../http/errores.js';
import {
  ENUMS, REGEX_PATENTE, exigirCampos, exigirEnum, normalizarPatente, pagina, paginacion, param, query,
  textoObligatorio, textoOpcional, type Body,
  } from '../../http/validacion.js';
import { FILTROS_ESTADO, dispositivoVigente, listarFlota, obtenerUnidad, type FiltroEstado, type Unidad } from './repositorio.js';
import { listarFallas } from '../fallas/repositorio.js';
import { listarPlanes } from '../mantenimiento/planes.js';


// M2 — Unidades (RF02, RN01) y M9 — vista de flota (RF14).

function anioValido(anio: unknown): number | null {
  if (anio === undefined || anio === null) return null;
  const max = new Date().getFullYear() + 1;
  if (!Number.isInteger(anio) || (anio as number) < 1950 || (anio as number) > max) {
    throw validacion(`anio debe ser un entero entre 1950 y ${max}.`);
  }
  return anio as number;
}

export function rutasUnidades({ sql }: Dependencias) {
  const r = Router();

  // Vista de flota (RF14). Por defecto solo activas; ?activa=false lista las dadas de baja.
  r.get('/unidades', async (req, res) => {
    const tenencia = query(req.query.tenencia);
    const estado = query(req.query.estado);
    const activa = query(req.query.activa);
    if (tenencia) exigirEnum('tenencia', tenencia, ENUMS.tenencia);
    if (estado && !FILTROS_ESTADO.includes(estado as FiltroEstado)) {
      throw validacion(`estado debe ser uno de: ${FILTROS_ESTADO.join(', ')}.`);
    }
    if (activa && !['true', 'false'].includes(activa)) throw validacion('activa debe ser true o false.');

    const pag = paginacion(req.query);
    const { data, total } = await listarFlota(sql, {
      activa: activa !== 'false',
      tenencia,
      estado: estado as FiltroEstado | undefined,
      limit: pag.pageSize,
      offset: pag.offset,
    });
    res.json(pagina(pag, data, total));
  });

  // Alta (RF02). Nace con km 0, fuente manual y sin planes ni dispositivo.
  r.post('/unidades', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['patente', 'marca', 'tenencia', 'protocolo']);
    const patente = normalizarPatente(b.patente);
    if (!REGEX_PATENTE.test(patente)) throw validacion('Patente inválida (6 a 10 letras o números, sin espacios).');
    exigirEnum('tenencia', b.tenencia, ENUMS.tenencia);
    exigirEnum('protocolo', b.protocolo, ENUMS.protocolo);

    const [creada] = await sql<Unidad[]>`
      insert into unidades (patente, marca, modelo, anio, tenencia, titular, protocolo, created_at)
      values (${patente}, ${textoObligatorio('marca', b.marca, 50)}, ${textoOpcional('modelo', b.modelo, 50)},
              ${anioValido(b.anio)}, ${b.tenencia}, ${textoOpcional('titular', b.titular, 100)}, ${b.protocolo}, ${new Date()})
      on conflict (patente) do nothing
      returning *`;
    if (!creada) throw conflicto('Ya existe una unidad con esa patente.');
    res.status(201).json(creada);
  });

    r.get('/unidades/:patente', async (req, res) => {
    res.json(await obtenerUnidad(sql, param(req.params.patente)));
  });

    // Detalle consolidado (RF15): unidad + dispositivo vigente + planes + fallas activas.
  r.get('/unidades/:patente/detalle', async (req, res) => {
    const unidad = await obtenerUnidad(sql, param(req.params.patente));
    // Las tres consultas son independientes: se lanzan en paralelo.
    const [dispositivo, planes, fallas_activas] = await Promise.all([
      dispositivoVigente(sql, unidad.patente),
      listarPlanes(sql, unidad.patente),
      listarFallas(sql, unidad.patente, 'activo'),
    ]);
    res.json({ unidad, dispositivo, planes, fallas_activas });
  });

  r.patch('/unidades/:patente', soloAdmin, async (req, res) => {
    const u = await obtenerUnidad(sql, param(req.params.patente));
    const b = req.body as Body;
    const cambios: Record<string, string | number | null> = {};
    if (b.marca !== undefined) cambios.marca = textoObligatorio('marca', b.marca, 50);
    if (b.modelo !== undefined) cambios.modelo = textoOpcional('modelo', b.modelo, 50);
    if (b.anio !== undefined) cambios.anio = anioValido(b.anio);
    if (b.titular !== undefined) cambios.titular = textoOpcional('titular', b.titular, 100);
    if (b.tenencia !== undefined) {
      exigirEnum('tenencia', b.tenencia, ENUMS.tenencia);
      cambios.tenencia = b.tenencia;
    }
    if (b.protocolo !== undefined) {
      exigirEnum('protocolo', b.protocolo, ENUMS.protocolo);
      cambios.protocolo = b.protocolo;
    }
    if (!Object.keys(cambios).length) {
      res.json(u);
      return;
    }
    // sql(objeto) arma "col1 = $1, col2 = $2" con las claves del objeto.
    const [act] = await sql<Unidad[]>`update unidades set ${sql(cambios)} where patente = ${u.patente} returning *`;
    res.json(act);
  });

  // Baja lógica (RF02, RNF11): conserva el historial. 409 si tiene un dispositivo vinculado.
  r.delete('/unidades/:patente', soloAdmin, async (req, res) => {
    const baja = await transaccion(sql, async (tx) => {
      const u = await obtenerUnidad(tx, param(req.params.patente), { bloquear: true });
      if (await dispositivoVigente(tx, u.patente)) {
        throw conflicto('La unidad tiene un dispositivo vinculado: desvinculalo antes de darla de baja.');
      }
      const [act] = await tx<Unidad[]>`update unidades set activa = false where patente = ${u.patente} returning *`;
      return act;
    });
    res.json(baja);
  });

  return r;
}

