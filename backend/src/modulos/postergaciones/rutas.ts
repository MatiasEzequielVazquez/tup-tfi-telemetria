import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { transaccion, type Sql } from '../../db.js';
import { noEncontrado, validacion } from '../../http/errores.js';
import {
  ENUMS, esTexto, exigirCampos, exigirEnum, pagina, paginacion, param, periodo, textoOpcional, type Body,
} from '../../http/validacion.js';
import { recalcularPlanes } from '../mantenimiento/planes.js';
import { obtenerUnidad } from '../unidades/repositorio.js';

// M5 — Postergaciones (RF10, RF16, RN07, RNF11). Las registra admin o mantenimiento (RN11).

interface FilaPostergacion {
  patente: string;
  codigo_tarea: string;
  tarea_nombre: string;
  fecha: Date;
  motivo: string;
  motivo_descripcion: string | null;
  km_limite_nuevo: number;
  email_usuario: string;
  usuario_nombre: string | null;
  cerrada: boolean;
  total: number;
}

/**
 * Historial de postergaciones, más recientes primero.
 * "fecha" es un instante (timestamptz) y desde/hasta son días de calendario en la zona del
 * negocio: el día "2026-10-21" en Argentina va de 03:00 UTC del 21 a 03:00 UTC del 22.
 */
async function listarPostergaciones(
  sql: Sql,
  patente: string,
  { desde, hasta }: { desde?: string; hasta?: string },
  { limit, offset }: { limit: number; offset: number },
  zona: string,
  codigoTarea?: string,
) {
  const filas = await sql<FilaPostergacion[]>`
    select p.patente, p.codigo_tarea, t.nombre as tarea_nombre, p.fecha, p.motivo, p.motivo_descripcion,
           p.km_limite_nuevo, p.email_usuario, us.nombre as usuario_nombre, p.cerrada,
           count(*) over ()::int as total
      from postergaciones p
      join tareas_catalogo t on t.codigo = p.codigo_tarea
      left join usuarios us on us.email = p.email_usuario
     where p.patente = ${patente}
       ${codigoTarea ? sql`and p.codigo_tarea = ${codigoTarea}` : sql``}
       ${desde ? sql`and p.fecha >= (${desde}::date)::timestamp at time zone ${zona}` : sql``}
       ${hasta ? sql`and p.fecha < (${hasta}::date + 1)::timestamp at time zone ${zona}` : sql``}
     order by p.fecha desc
     limit ${limit} offset ${offset}`;
  return { total: filas[0]?.total ?? 0, data: filas.map(({ total: _t, ...p }) => p) };
}

export function rutasPostergaciones({ sql, config }: Dependencias) {
  const r = Router();
  const zona = config.reglas.zonaHoraria;

  r.get('/unidades/:patente/postergaciones', async (req, res) => {
    const u = await obtenerUnidad(sql, param(req.params.patente));
    const pag = paginacion(req.query);
    const { data, total } = await listarPostergaciones(sql, u.patente, periodo(req.query), { limit: pag.pageSize, offset: pag.offset }, zona);
    res.json(pagina(pag, data, total));
  });

  r.post('/unidades/:patente/planes/:codigo_tarea/postergaciones', async (req, res) => {
    const b = req.body as Body;
    const codigo = param(req.params.codigo_tarea);

    const post = await transaccion(sql, async (tx) => {
      const u = await obtenerUnidad(tx, param(req.params.patente), { bloquear: true });
      const [plan] = await tx`select 1 from planes_mantenimiento where patente = ${u.patente} and codigo_tarea = ${codigo}`;
      if (!plan) throw noEncontrado('La unidad no tiene ese plan.');

      // RN07
      exigirCampos(b, ['motivo', 'km_limite_nuevo']);
      exigirEnum('motivo', b.motivo, ENUMS.motivo);
      if (b.motivo === 'otro' && !esTexto(b.motivo_descripcion)) {
        throw validacion('Con motivo "otro" la descripción es obligatoria (RN07).');
      }
      if (!Number.isInteger(b.km_limite_nuevo)) throw validacion('km_limite_nuevo debe ser un entero.');
      const limite = b.km_limite_nuevo as number;
      if (limite <= u.km_actual) throw validacion(`El nuevo límite debe ser mayor al km actual (${u.km_actual}).`);

      const fecha = new Date();
      await tx`
        insert into postergaciones (patente, codigo_tarea, fecha, motivo, motivo_descripcion, km_limite_nuevo, email_usuario, cerrada)
        values (${u.patente}, ${codigo}, ${fecha}, ${b.motivo}, ${textoOpcional('motivo_descripcion', b.motivo_descripcion, 255)},
                ${limite}, ${req.usuario!.email}, false)`;

      await recalcularPlanes(tx, u.patente); // el plan pasa a "postergada"
      const { data } = await listarPostergaciones(tx, u.patente, {}, { limit: 1, offset: 0 }, zona, codigo);
      return data[0]; // la recién creada es la más reciente de esa tarea
    });
    res.status(201).json(post);
  });

  return r;
}