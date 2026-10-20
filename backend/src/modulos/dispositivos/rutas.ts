import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { soloAdmin } from '../../auth/middleware.js';
import { transaccion, type Sql } from '../../db.js';
import { conflicto, noEncontrado, validacion } from '../../http/errores.js';
import { REGEX_DEVICE_UID, exigirCampos, param, type Body } from '../../http/validacion.js';
import { obtenerUnidad, type EstadoDispositivo } from '../unidades/repositorio.js';

// M2 — Dispositivos y su historial de vinculaciones (RF03, RN02). Solo admin (RN11).

interface FilaDispositivo {
  device_uid: string;
  estado: EstadoDispositivo;
  ultima_comunicacion: Date | null;
  created_at: Date;
  v_patente: string | null;
  v_desde: Date | null;
}

// Forma del contrato: la vinculación vigente como objeto anidado, o null.
const vista = ({ v_patente, v_desde, ...d }: FilaDispositivo) => ({
  ...d,
  vinculacion_actual: v_patente ? { patente: v_patente, desde: v_desde } : null,
});

async function listar(sql: Sql, deviceUid?: string) {
  const filas = await sql<FilaDispositivo[]>`
    select d.device_uid, d.estado, d.ultima_comunicacion, d.created_at, v.patente as v_patente, v.desde as v_desde
      from dispositivos d
      left join vinculaciones v on v.device_uid = d.device_uid and v.hasta is null
     ${deviceUid ? sql`where d.device_uid = ${deviceUid}` : sql``}
     order by d.device_uid`;
  return filas.map(vista);
}

async function obtener(sql: Sql, deviceUid: string) {
  const [d] = await listar(sql, deviceUid);
  if (!d) throw noEncontrado('No existe el dispositivo.');
  return d;
}

export function rutasDispositivos({ sql }: Dependencias) {
  const r = Router();

  r.get('/dispositivos', soloAdmin, async (_req, res) => {
    res.json({ data: await listar(sql) });
  });

  // Alta: nace inactivo y sin vincular. Pasa a activo con su primer mensaje MQTT (M3).
  r.post('/dispositivos', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['device_uid']);
    if (typeof b.device_uid !== 'string' || !REGEX_DEVICE_UID.test(b.device_uid)) {
      throw validacion('device_uid inválido (3 a 50 caracteres: letras, números, guion o guion bajo).');
    }
    const [d] = await sql`
      insert into dispositivos (device_uid, created_at) values (${b.device_uid}, ${new Date()})
      on conflict do nothing returning 1`;
    if (!d) throw conflicto('Ya existe un dispositivo con ese device_uid.');
    res.status(201).json(await obtener(sql, b.device_uid));
  });

  // Vincular (RN02). Todo en una transacción con locks: entre los chequeos y el insert,
  // nadie más puede vincular ese dispositivo ni esa unidad.
  r.patch('/dispositivos/:device_uid/vincular', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['patente']);
    const uid = param(req.params.device_uid);

    await transaccion(sql, async (tx) => {
      const [d] = await tx`select 1 from dispositivos where device_uid = ${uid} for update`;
      if (!d) throw noEncontrado('No existe el dispositivo.');
      const u = await obtenerUnidad(tx, b.patente, { bloquear: true });
      if (!u.activa) throw validacion('No se puede vincular a una unidad dada de baja.');

      const [ocupado] = await tx`select 1 from vinculaciones where device_uid = ${uid} and hasta is null`;
      if (ocupado) throw conflicto('El dispositivo ya está vinculado a una unidad (RN02).');
      const [conDisp] = await tx`select 1 from vinculaciones where patente = ${u.patente} and hasta is null`;
      if (conDisp) throw conflicto('La unidad ya tiene un dispositivo vinculado (RN02).');

      await tx`insert into vinculaciones (device_uid, patente, desde) values (${uid}, ${u.patente}, ${new Date()})`;
    });
    res.json(await obtener(sql, uid));
  });

  r.patch('/dispositivos/:device_uid/desvincular', soloAdmin, async (req, res) => {
    const uid = param(req.params.device_uid);

    await transaccion(sql, async (tx) => {
      const [d] = await tx`select 1 from dispositivos where device_uid = ${uid} for update`;
      if (!d) throw noEncontrado('No existe el dispositivo.');
      // El rango [desde, hasta) no puede quedar vacío (check hasta > desde del esquema):
      // si se desvincula en el mismo milisegundo en que se vinculó, hasta = desde + 1 ms.
      const cerradas = await tx`
        update vinculaciones set hasta = greatest(${new Date()}::timestamptz, desde + interval '1 millisecond')
         where device_uid = ${uid} and hasta is null
        returning 1`;
      if (!cerradas.length) throw conflicto('El dispositivo no está vinculado a ninguna unidad.');
      await tx`update dispositivos set estado = 'inactivo' where device_uid = ${uid}`;
    });
    res.json(await obtener(sql, uid));
  });

  return r;
}