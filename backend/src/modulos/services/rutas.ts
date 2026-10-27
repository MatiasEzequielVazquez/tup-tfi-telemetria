import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { transaccion, type Sql } from '../../db.js';
import { conflicto, validacion } from '../../http/errores.js';
import {
  esFechaValida, esNumero, exigirCampos, hoyEn, pagina, paginacion, param, periodo, textoOpcional, type Body,
} from '../../http/validacion.js';
import { recalcularPlanes } from '../mantenimiento/planes.js';
import { obtenerUnidad } from '../unidades/repositorio.js';

// M5 — Services (RF09, RF16, RN06, RNF11). Los registra admin o mantenimiento (RN11).

interface FilaService {
  patente: string;
  fecha: string;
  km: number;
  observaciones: string | null;
  email_usuario: string;
  usuario_nombre: string | null;
  tareas: { codigo_tarea: string; nombre: string }[];
  total: number;
}

/** Historial de services, más recientes primero, con sus tareas y quién lo registró. */
export async function listarServices(
  sql: Sql,
  patente: string,
  { desde, hasta }: { desde?: string; hasta?: string },
  { limit, offset }: { limit: number; offset: number },
) {
  const filas = await sql<FilaService[]>`
    select s.patente, s.fecha, s.km, s.observaciones, s.email_usuario, us.nombre as usuario_nombre,
           coalesce((select json_agg(json_build_object('codigo_tarea', st.codigo_tarea, 'nombre', t.nombre)
                                     order by t.intervalo_km_default, t.codigo)
                       from service_tareas st join tareas_catalogo t on t.codigo = st.codigo_tarea
                      where st.patente = s.patente and st.fecha = s.fecha), '[]'::json) as tareas,
           count(*) over ()::int as total
      from services s
      left join usuarios us on us.email = s.email_usuario
     where s.patente = ${patente}
       ${desde ? sql`and s.fecha >= ${desde}::date` : sql``}
       ${hasta ? sql`and s.fecha <= ${hasta}::date` : sql``}
     order by s.fecha desc
     limit ${limit} offset ${offset}`;
  return { total: filas[0]?.total ?? 0, data: filas.map(({ total: _t, ...s }) => s) };
}

export function rutasServices({ sql, config }: Dependencias) {
  const r = Router();
  const zona = config.reglas.zonaHoraria;

  r.get('/unidades/:patente/services', async (req, res) => {
    const u = await obtenerUnidad(sql, param(req.params.patente));
    const pag = paginacion(req.query);
    const { data, total } = await listarServices(sql, u.patente, periodo(req.query), { limit: pag.pageSize, offset: pag.offset });
    res.json(pagina(pag, data, total));
  });

  r.post('/unidades/:patente/services', async (req, res) => {
    const b = req.body as Body;

    // Validaciones que no necesitan la base: van antes de abrir la transacción.
    exigirCampos(b, ['km']);
    if (!esNumero(b.km) || b.km < 0) throw validacion('km debe ser un número mayor o igual a 0.');
    const km = b.km;
    const hoy = hoyEn(zona);
    const fecha = b.fecha ?? hoy;
    if (!esFechaValida(fecha)) throw validacion('fecha debe tener formato YYYY-MM-DD.');
    if (fecha > hoy) throw validacion('La fecha del service no puede ser futura.');
    if (!Array.isArray(b.tareas) || b.tareas.length === 0) throw validacion('Seleccioná al menos una tarea.');
    if (!b.tareas.every((t) => typeof t === 'string')) throw validacion('tareas debe ser una lista de códigos de tarea.');
    const codigos = [...new Set(b.tareas as string[])]; // sin duplicados
    const observaciones = textoOpcional('observaciones', b.observaciones, 2000);

    const service = await transaccion(sql, async (tx) => {
      const u = await obtenerUnidad(tx, param(req.params.patente), { bloquear: true });
      if (!u.activa) throw validacion('La unidad está dada de baja.');

      // service_tareas apunta al catálogo, no al plan (evita un ciclo en el DER):
      // acá se verifica que cada tarea esté en el plan de la unidad.
      const enPlan = await tx<{ codigo_tarea: string }[]>`
        select codigo_tarea from planes_mantenimiento where patente = ${u.patente} and activo and codigo_tarea in ${tx(codigos)}`;
      const sinPlan = codigos.filter((c) => !enPlan.some((p) => p.codigo_tarea === c));
      if (sinPlan.length) throw validacion(`Tareas que no están en el plan activo de la unidad: ${sinPlan.join(', ')}.`);

      // Un service por unidad y por día: lo garantiza la PK (patente, fecha).
      const [creado] = await tx`
        insert into services (patente, fecha, km, observaciones, email_usuario, created_at)
        values (${u.patente}, ${fecha}, ${km}, ${observaciones}, ${req.usuario!.email}, ${new Date()})
        on conflict do nothing returning 1`;
      if (!creado) throw conflicto('Ya hay un service registrado para esa unidad en esa fecha.');

      await tx`insert into service_tareas ${tx(codigos.map((c) => ({ patente: u.patente, fecha, codigo_tarea: c })))}`;

      // RN06: reinicia la cuenta de cada plan cubierto y cierra sus postergaciones abiertas.
      await tx`update planes_mantenimiento set km_ultimo_service = ${km}
                where patente = ${u.patente} and codigo_tarea in ${tx(codigos)}`;
      await tx`update postergaciones set cerrada = true
                where patente = ${u.patente} and codigo_tarea in ${tx(codigos)} and not cerrada`;

      // RN08: el km del service puede adelantar el de la unidad, nunca atrasarlo (RN09).
      if (km > u.km_actual) {
        await tx`update unidades set km_actual = ${km}, km_fuente = 'manual' where patente = ${u.patente}`;
      }

      await recalcularPlanes(tx, u.patente);
      const { data } = await listarServices(tx, u.patente, { desde: fecha, hasta: fecha }, { limit: 1, offset: 0 });
      return data[0];
    });
    res.status(201).json(service);
  });

  return r;
}