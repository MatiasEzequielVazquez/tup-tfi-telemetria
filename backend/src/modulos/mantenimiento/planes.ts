import type { Sql } from '../../db.js';
import type { EstadoPlan } from '../unidades/repositorio.js';
import { alertaPorEstado, evaluarPlan, redondear } from './reglas.js';

// M4 — Planes de mantenimiento (RF07, RF08).

interface FilaPlan {
  patente: string;
  codigo_tarea: string;
  nombre: string;
  intervalo_km: number;
  umbral_aviso_km: number;
  km_ultimo_service: number;
  estado: EstadoPlan;
  km_actual: number;
  post_fecha: Date | null;
  post_motivo: string | null;
  post_motivo_descripcion: string | null;
  post_km_limite_nuevo: number | null;
  post_email_usuario: string | null;
}

/** Planes de una unidad (o uno solo), con el km actual y la postergación abierta más reciente. */
function consultarPlanes(sql: Sql, patente: string, codigoTarea?: string) {
  return sql<FilaPlan[]>`
    select p.patente, p.codigo_tarea, t.nombre, p.intervalo_km, p.umbral_aviso_km, p.km_ultimo_service,
           p.estado, u.km_actual,
           pg.fecha as post_fecha, pg.motivo as post_motivo, pg.motivo_descripcion as post_motivo_descripcion,
           pg.km_limite_nuevo as post_km_limite_nuevo, pg.email_usuario as post_email_usuario
      from planes_mantenimiento p
      join tareas_catalogo t on t.codigo = p.codigo_tarea
      join unidades u on u.patente = p.patente
      left join lateral (
        select * from postergaciones x
         where x.patente = p.patente and x.codigo_tarea = p.codigo_tarea and not x.cerrada
         order by x.fecha desc
         limit 1
      ) pg on true
     where p.patente = ${patente}
       ${codigoTarea ? sql`and p.codigo_tarea = ${codigoTarea}` : sql``}
     order by t.intervalo_km_default, t.codigo`;
}

const postergacionDe = (f: FilaPlan) =>
  f.post_fecha && f.post_km_limite_nuevo !== null
    ? {
        fecha: f.post_fecha,
        motivo: f.post_motivo,
        motivo_descripcion: f.post_motivo_descripcion,
        km_limite_nuevo: f.post_km_limite_nuevo,
        email_usuario: f.post_email_usuario,
      }
    : null;

/** Forma del Plan en el contrato (openapi: Plan). */
function vistaPlan(f: FilaPlan) {
  const post = postergacionDe(f);
  const { km_limite } = evaluarPlan(f, f.km_actual, post);
  return {
    codigo_tarea: f.codigo_tarea,
    nombre: f.nombre,
    intervalo_km: f.intervalo_km,
    umbral_aviso_km: f.umbral_aviso_km,
    km_ultimo_service: f.km_ultimo_service,
    km_limite,
    km_restantes: redondear(km_limite - f.km_actual), // negativo si ya venció
    estado: f.estado,
    postergacion_vigente: post,
  };
}

export async function listarPlanes(sql: Sql, patente: string) {
  return (await consultarPlanes(sql, patente)).map(vistaPlan);
}

export async function obtenerPlan(sql: Sql, patente: string, codigoTarea: string) {
  const [f] = await consultarPlanes(sql, patente, codigoTarea);
  return f ? vistaPlan(f) : null;
}

/**
 * Recalcula el estado de todos los planes de una unidad (RN04, RN05, RN07) y genera una
 * alerta cada vez que un plan PASA a próxima o vencida (RF12).
 *
 * Tiene que llamarse DENTRO de una transacción, después de cualquier cambio de km, service,
 * postergación o configuración de un plan. Bloquea la fila de la unidad: así la ingesta MQTT
 * y la API nunca recalculan la misma unidad a la vez.
 */
export async function recalcularPlanes(tx: Sql, patente: string, instante = new Date()) {
  await tx`select 1 from unidades where patente = ${patente} for update`;
  const cambios: { codigo_tarea: string; de: EstadoPlan; a: EstadoPlan }[] = [];

  for (const f of await consultarPlanes(tx, patente)) {
    const { estado } = evaluarPlan(f, f.km_actual, postergacionDe(f));
    if (estado === f.estado) continue;

    await tx`update planes_mantenimiento set estado = ${estado}
              where patente = ${patente} and codigo_tarea = ${f.codigo_tarea}`;
    const tipo = alertaPorEstado(estado);
    if (tipo) {
      await tx`insert into alertas_plan (patente, codigo_tarea, tipo, fecha_generada)
               values (${patente}, ${f.codigo_tarea}, ${tipo}, ${instante})
               on conflict do nothing`;
    }
    cambios.push({ codigo_tarea: f.codigo_tarea, de: f.estado, a: estado });
  }
  return cambios;
}