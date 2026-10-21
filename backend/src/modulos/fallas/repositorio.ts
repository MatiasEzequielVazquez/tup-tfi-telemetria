import type { Sql } from '../../db.js';

// M6 — Fallas (DTC) informadas por cada unidad (RF11, RN12).
// Una falla está activa mientras no tenga fecha_cierre: el estado se deduce, no se guarda.

interface FilaFalla {
  codigo: string;
  fecha_aparicion: Date;
  fecha_cierre: Date | null;
}

export const vistaFalla = (f: FilaFalla) => ({
  codigo: f.codigo,
  fecha_aparicion: f.fecha_aparicion,
  fecha_cierre: f.fecha_cierre,
  estado: f.fecha_cierre ? 'inactivo' : 'activo',
});

export async function listarFallas(sql: Sql, patente: string, estado?: 'activo' | 'inactivo') {
  const filas = await sql<FilaFalla[]>`
    select codigo, fecha_aparicion, fecha_cierre from fallas
     where patente = ${patente}
       ${estado === 'activo' ? sql`and fecha_cierre is null` : sql``}
       ${estado === 'inactivo' ? sql`and fecha_cierre is not null` : sql``}
     order by fecha_aparicion desc, codigo`;
  return filas.map(vistaFalla);
}

/**
 * RN12: un código informado como activo abre una falla si no tenía una aparición abierta,
 * y genera su alerta "falla nueva". Devuelve true si abrió una.
 */
export async function abrirFalla(tx: Sql, p: { patente: string; codigo: string; fechaAparicion: Date; instante: Date }) {
  const [abierta] = await tx`select 1 from fallas where patente = ${p.patente} and codigo = ${p.codigo} and fecha_cierre is null`;
  if (abierta) return false;
  const insertadas = await tx`
    insert into fallas (patente, codigo, fecha_aparicion) values (${p.patente}, ${p.codigo}, ${p.fechaAparicion})
    on conflict do nothing returning 1`;
  if (!insertadas.length) return false; // esa misma aparición ya existía (mensaje repetido)
  await tx`insert into alertas_falla (patente, codigo, fecha_aparicion, fecha_generada)
           values (${p.patente}, ${p.codigo}, ${p.fechaAparicion}, ${p.instante})`;
  return true;
}

/** RN12: cierra la aparición abierta de un código. Devuelve true si cerró alguna. */
export async function cerrarFalla(tx: Sql, p: { patente: string; codigo: string; fechaCierre: Date }) {
  const r = await tx`
    update fallas set fecha_cierre = greatest(${p.fechaCierre}::timestamptz, fecha_aparicion)
     where patente = ${p.patente} and codigo = ${p.codigo} and fecha_cierre is null
    returning 1`;
  return r.length > 0;
}