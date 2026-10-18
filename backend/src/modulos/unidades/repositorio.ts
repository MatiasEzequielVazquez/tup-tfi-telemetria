import type { Sql } from '../../db.js';
import { noEncontrado } from '../../http/errores.js';
import { normalizarPatente } from '../../http/validacion.js';

export type EstadoPlan = 'al_dia' | 'proxima' | 'vencida' | 'postergada';
export type EstadoDispositivo = 'activo' | 'inactivo' | 'sin_reportar';

export interface Unidad {
  patente: string;
  marca: string;
  modelo: string | null;
  anio: number | null;
  tenencia: 'propia' | 'fletero';
  titular: string | null;
  protocolo: 'J1939' | 'J1979';
  km_actual: number;
  km_fuente: 'odometro' | 'estimado' | 'manual';
  activa: boolean;
  created_at: Date;
}

/** Devuelve la unidad o lanza 404. bloquear: lock de fila (usar dentro de una transacción). */
export async function obtenerUnidad(sql: Sql, patente: unknown, { bloquear = false } = {}): Promise<Unidad> {
  const p = normalizarPatente(patente);
  const [u] = await sql<Unidad[]>`
    select patente, marca, modelo, anio, tenencia, titular, protocolo, km_actual, km_fuente, activa, created_at
      from unidades where patente = ${p} ${bloquear ? sql`for update` : sql``}`;
  if (!u) throw noEncontrado(`No existe la unidad ${p}.`);
  return u;
}

/** Dispositivo vinculado hoy a la unidad (vinculación sin "hasta"), o null. */
export async function dispositivoVigente(sql: Sql, patente: string) {
  const [d] = await sql<{ device_uid: string; estado: EstadoDispositivo; ultima_comunicacion: Date | null; desde: Date }[]>`
    select d.device_uid, d.estado, d.ultima_comunicacion, v.desde
      from vinculaciones v join dispositivos d on d.device_uid = v.device_uid
     where v.patente = ${patente} and v.hasta is null`;
  return d ?? null;
}

export const FILTROS_ESTADO = ['al_dia', 'proxima', 'vencida', 'postergada', 'con_fallas', 'sin_reportar', 'sin_dispositivo'] as const;
export type FiltroEstado = (typeof FILTROS_ESTADO)[number];

interface FilaFlota extends Omit<Unidad, 'created_at'> {
  estado_mantenimiento: EstadoPlan | null;
  fallas_activas: number;
  device_uid: string | null;
  dispositivo_estado: EstadoDispositivo | null;
  ultima_comunicacion: Date | null;
  total: number;
}

/**
 * Vista de flota (RF14): una fila por unidad con su estado más crítico
 * (vencida > próxima > postergada > al día), fallas activas y dispositivo vigente.
 * Filtra y pagina en la base; count(*) over () trae el total en la misma consulta.
 */
export async function listarFlota(
  sql: Sql,
  f: { activa: boolean; tenencia?: string; estado?: FiltroEstado; limit: number; offset: number },
): Promise<{ total: number; data: unknown[] }> {
  const filas = await sql<FilaFlota[]>`
    with resumen as (
      select u.patente, u.marca, u.modelo, u.anio, u.tenencia, u.titular, u.protocolo, u.km_actual, u.km_fuente, u.activa,
             (select case min(case p.estado when 'vencida' then 1 when 'proxima' then 2 when 'postergada' then 3 else 4 end)
                       when 1 then 'vencida' when 2 then 'proxima' when 3 then 'postergada' when 4 then 'al_dia' end
                from planes_mantenimiento p where p.patente = u.patente) as estado_mantenimiento,
             (select count(*)::int from fallas fa where fa.patente = u.patente and fa.fecha_cierre is null) as fallas_activas,
             d.device_uid, d.estado as dispositivo_estado, d.ultima_comunicacion
        from unidades u
        left join vinculaciones v on v.patente = u.patente and v.hasta is null
        left join dispositivos d on d.device_uid = v.device_uid
       where u.activa = ${f.activa}
         ${f.tenencia ? sql`and u.tenencia = ${f.tenencia}` : sql``}
    )
    select *, count(*) over ()::int as total
      from resumen
     where true
       ${f.estado === 'con_fallas' ? sql`and fallas_activas > 0` : sql``}
       ${f.estado === 'sin_reportar' ? sql`and dispositivo_estado = 'sin_reportar'` : sql``}
       ${f.estado === 'sin_dispositivo' ? sql`and device_uid is null` : sql``}
       ${f.estado && ['al_dia', 'proxima', 'vencida', 'postergada'].includes(f.estado) ? sql`and estado_mantenimiento = ${f.estado}` : sql``}
     order by patente
     limit ${f.limit} offset ${f.offset}`;

  // Una página fuera de rango no trae filas (ni el total): se cuenta aparte.
  let total = filas[0]?.total ?? 0;
  if (!filas.length && f.offset > 0) total = (await listarFlota(sql, { ...f, limit: 1, offset: 0 })).total;

  const data = filas.map(({ total: _t, device_uid, dispositivo_estado, ultima_comunicacion, ...u }) => ({
    ...u,
    dispositivo: device_uid ? { device_uid, estado: dispositivo_estado, ultima_comunicacion } : null,
  }));
  return { total, data };
}