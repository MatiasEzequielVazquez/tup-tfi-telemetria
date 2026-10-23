import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import type { Sql } from '../../db.js';
import { noEncontrado, validacion } from '../../http/errores.js';
import { ENUMS, exigirCampos, exigirEnum, normalizarPatente, pagina, paginacion, query, type Body } from '../../http/validacion.js';

// M7 — Alertas (RF12, RF13). Se generan internamente (M4, M6, M8); acá se listan y se revisan.

type Origen = 'plan' | 'falla' | 'dispositivo';

interface FilaAlerta {
  origen: Origen;
  tipo: string;
  patente: string | null;
  referencia: string;
  referencia_nombre: string | null;
  fecha_generada: Date;
  fecha_revisada: Date | null;
  k_patente: string | null;
  k_codigo_tarea: string | null;
  k_tipo: string | null;
  k_codigo: string | null;
  k_fecha_aparicion: Date | null;
  k_device_uid: string | null;
}

/**
 * Las tres tablas unidas con las mismas columnas (como la vista SQL "alertas"), más las
 * columnas k_* con la clave de cada origen. En las de dispositivo, la patente sale de la
 * vinculación vigente cuando se generó la alerta.
 */
const consultaAlertas = (sql: Sql) => sql`
  select 'plan' as origen, a.tipo::text as tipo, a.patente, a.codigo_tarea as referencia, t.nombre as referencia_nombre,
         a.fecha_generada, a.fecha_revisada,
         a.patente as k_patente, a.codigo_tarea as k_codigo_tarea, a.tipo::text as k_tipo,
         null::text as k_codigo, null::timestamptz as k_fecha_aparicion, null::text as k_device_uid
    from alertas_plan a join tareas_catalogo t on t.codigo = a.codigo_tarea
  union all
  select 'falla', 'falla_nueva', a.patente, a.codigo, null,
         a.fecha_generada, a.fecha_revisada,
         a.patente, null, null, a.codigo, a.fecha_aparicion, null
    from alertas_falla a
  union all
  select 'dispositivo', 'dispositivo_sin_reportar', v.patente, a.device_uid, null,
         a.fecha_generada, a.fecha_revisada,
         null, null, null, null, null, a.device_uid
    from alertas_dispositivo a
    left join vinculaciones v
      on v.device_uid = a.device_uid and a.fecha_generada >= v.desde and (v.hasta is null or a.fecha_generada < v.hasta)`;

/** Forma del contrato: la clave depende del origen. */
function vistaAlerta(f: FilaAlerta) {
  const clave =
    f.origen === 'plan'
      ? { patente: f.k_patente, codigo_tarea: f.k_codigo_tarea, tipo: f.k_tipo, fecha_generada: f.fecha_generada }
      : f.origen === 'falla'
        ? { patente: f.k_patente, codigo: f.k_codigo, fecha_aparicion: f.k_fecha_aparicion }
        : { device_uid: f.k_device_uid, fecha_generada: f.fecha_generada };
  return {
    origen: f.origen,
    tipo: f.tipo,
    patente: f.patente,
    referencia: f.referencia,
    referencia_nombre: f.referencia_nombre,
    fecha_generada: f.fecha_generada,
    fecha_revisada: f.fecha_revisada,
    estado: f.fecha_revisada ? 'revisada' : 'abierta',
    clave,
  };
}

/** Compara dos instantes con precisión de milisegundos (la que maneja JS). */
const mismoInstante = (sql: Sql, columna: string, valor: string | Date) =>
  sql`date_trunc('milliseconds', ${sql(columna)}) = date_trunc('milliseconds', ${valor}::timestamptz)`;

function fechaClave(campo: string, valor: unknown): string {
  if (typeof valor !== 'string' || Number.isNaN(Date.parse(valor))) throw validacion(`${campo} debe ser una fecha ISO 8601.`);
  return valor;
}

export function rutasAlertas({ sql }: Dependencias) {
  const r = Router();

  // Listado (RF13): de la más antigua a la más reciente. Sin "estado" trae abiertas y revisadas.
  r.get('/alertas', async (req, res) => {
    const estado = query(req.query.estado);
    const tipo = query(req.query.tipo);
    const patente = query(req.query.patente);
    if (estado && estado !== 'abierta' && estado !== 'revisada') throw validacion('estado debe ser abierta o revisada.');
    if (tipo) exigirEnum('tipo', tipo, ENUMS.tipoAlerta);

    const pag = paginacion(req.query);
    const filas = await sql<(FilaAlerta & { total: number })[]>`
      select *, count(*) over ()::int as total
        from (${consultaAlertas(sql)}) a
       where true
         ${estado === 'abierta' ? sql`and fecha_revisada is null` : sql``}
         ${estado === 'revisada' ? sql`and fecha_revisada is not null` : sql``}
         ${tipo ? sql`and tipo = ${tipo}` : sql``}
         ${patente ? sql`and patente = ${normalizarPatente(patente)}` : sql``}
       order by fecha_generada, origen, referencia
       limit ${pag.pageSize} offset ${pag.offset}`;
    res.json(pagina(pag, filas.map(vistaAlerta), filas[0]?.total ?? 0));
  });

  // Marcar como revisada (RF13). Body: { origen, ...clave }. Idempotente: si ya estaba
  // revisada, coalesce conserva la fecha original.
  r.patch('/alertas/revisar', async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['origen']);
    const ahora = new Date();
    let filtro;

    if (b.origen === 'plan') {
      exigirCampos(b, ['patente', 'codigo_tarea', 'tipo', 'fecha_generada']);
      const fg = fechaClave('fecha_generada', b.fecha_generada);
      const [k] = await sql<{ fecha_generada: Date }[]>`
        update alertas_plan set fecha_revisada = coalesce(fecha_revisada, ${ahora})
         where patente = ${normalizarPatente(b.patente)} and codigo_tarea = ${String(b.codigo_tarea)}
           and tipo::text = ${String(b.tipo)} and ${mismoInstante(sql, 'fecha_generada', fg)}
        returning fecha_generada`;
      if (!k) throw noEncontrado('No existe esa alerta.');
      filtro = sql`origen = 'plan' and k_patente = ${normalizarPatente(b.patente)} and k_codigo_tarea = ${String(b.codigo_tarea)}
                   and k_tipo = ${String(b.tipo)} and ${mismoInstante(sql, 'fecha_generada', k.fecha_generada)}`;
    } else if (b.origen === 'falla') {
      exigirCampos(b, ['patente', 'codigo', 'fecha_aparicion']);
      const fa = fechaClave('fecha_aparicion', b.fecha_aparicion);
      const [k] = await sql<{ fecha_aparicion: Date }[]>`
        update alertas_falla set fecha_revisada = coalesce(fecha_revisada, ${ahora})
         where patente = ${normalizarPatente(b.patente)} and codigo = ${String(b.codigo)}
           and ${mismoInstante(sql, 'fecha_aparicion', fa)}
        returning fecha_aparicion`;
      if (!k) throw noEncontrado('No existe esa alerta.');
      filtro = sql`origen = 'falla' and k_patente = ${normalizarPatente(b.patente)} and k_codigo = ${String(b.codigo)}
                   and ${mismoInstante(sql, 'k_fecha_aparicion', k.fecha_aparicion)}`;
    } else if (b.origen === 'dispositivo') {
      exigirCampos(b, ['device_uid', 'fecha_generada']);
      const fg = fechaClave('fecha_generada', b.fecha_generada);
      const [k] = await sql<{ fecha_generada: Date }[]>`
        update alertas_dispositivo set fecha_revisada = coalesce(fecha_revisada, ${ahora})
         where device_uid = ${String(b.device_uid)} and ${mismoInstante(sql, 'fecha_generada', fg)}
        returning fecha_generada`;
      if (!k) throw noEncontrado('No existe esa alerta.');
      filtro = sql`origen = 'dispositivo' and k_device_uid = ${String(b.device_uid)}
                   and ${mismoInstante(sql, 'fecha_generada', k.fecha_generada)}`;
    } else {
      throw validacion('origen debe ser plan, falla o dispositivo.');
    }

    // Devuelve la alerta actualizada con la misma forma que el listado.
    const [alerta] = await sql<FilaAlerta[]>`select * from (${consultaAlertas(sql)}) a where ${filtro}`;
    res.json(vistaAlerta(alerta!));
  });

  return r;
}