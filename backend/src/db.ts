import postgres from 'postgres';

// OIDs de PostgreSQL que convertimos distinto al default de postgres.js.
const OID = { numeric: 1700, int8: 20, date: 1082 } as const;

/**
 * Cliente SQL. Todas las consultas usan tagged templates (sql`...${valor}`),
 * así los valores siempre viajan como parámetros.
 *
 * - numeric/int8 -> number (por defecto postgres.js los devuelve como string).
 * - date -> string 'YYYY-MM-DD' (services.fecha no tiene hora; un Date la correría de día).
 * - prepare: false -> compatible con el pooler de Supabase.
 */
export function crearSql(url: string, opciones: postgres.Options<{}> = {}) {
  return postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
    types: {
      numeric: { to: OID.numeric, from: [OID.numeric], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: OID.int8, from: [OID.int8], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      fecha: { to: OID.date, from: [OID.date], serialize: (x: string) => x, parse: (x: string) => x },
    },
    ...opciones,
  });
}

export type Sql = ReturnType<typeof crearSql>;

/**
 * Ejecuta fn dentro de una transacción: si algo falla, se deshace todo.
 * Envoltorio sobre sql.begin porque los tipos de postgres.js pierden la firma
 * "llamable" del objeto tx (tx`...` da error de tipos aunque funciona).
 */
export async function transaccion<T>(sql: Sql, fn: (tx: Sql) => Promise<T>): Promise<T> {
  return (await sql.begin((tx) => fn(tx as unknown as Sql))) as T;
}