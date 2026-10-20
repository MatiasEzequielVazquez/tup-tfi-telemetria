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