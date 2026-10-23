// Genera db/seed.sql (DML) desde los datos del mock y, con --cargar, lo ejecuta en DATABASE_URL.
//   npx tsx scripts/seed.ts                          -> solo genera db/seed.sql
//   npx tsx --env-file=.env scripts/seed.ts --cargar -> genera y carga
// Borra los datos de la flota; conserva usuarios y catálogo de tareas.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearSql } from '../src/db.js';

type Fila = Record<string, unknown>;
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const db = JSON.parse(fs.readFileSync(path.join(raiz, 'mock', 'data', 'db.json'), 'utf8')) as Record<string, Fila[]>;

const REF = Date.parse('2026-10-07T15:00:00Z'); // fecha de referencia de los datos del mock
const REF_DIA = Date.parse('2026-10-07T00:00:00Z');

const lit = (v: unknown) =>
  v === null || v === undefined ? 'null'
  : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`;
const ts = (v: unknown) =>
  v == null ? 'null' : `(select t from _ref) - interval '${(REF - Date.parse(String(v))) / 1000} seconds'`;
const dia = (v: unknown) =>
  `(select d from _ref) - ${Math.round((REF_DIA - Date.parse(`${String(v)}T00:00:00Z`)) / 86_400_000)}`;

// Tablas en orden de dependencias (FK) y cómo se escribe cada columna.
const TABLAS: [string, Record<string, (v: unknown) => string>][] = [
  ['unidades', { patente: lit, marca: lit, modelo: lit, anio: lit, tenencia: lit, titular: lit, protocolo: lit, km_actual: lit, km_fuente: lit, activa: lit, created_at: ts }],
  ['dispositivos', { device_uid: lit, estado: lit, ultima_comunicacion: ts, created_at: ts }],
  ['vinculaciones', { device_uid: lit, patente: lit, desde: ts, hasta: ts }],
  ['planes_mantenimiento', { patente: lit, codigo_tarea: lit, intervalo_km: lit, umbral_aviso_km: lit, km_ultimo_service: lit, estado: lit, created_at: ts }],
  ['services', { patente: lit, fecha: dia, km: lit, observaciones: lit, email_usuario: lit, created_at: ts }],
  ['service_tareas', { patente: lit, fecha: dia, codigo_tarea: lit }],
  ['postergaciones', { patente: lit, codigo_tarea: lit, fecha: ts, motivo: lit, motivo_descripcion: lit, km_limite_nuevo: lit, email_usuario: lit, cerrada: lit }],
  ['fallas', { patente: lit, codigo: lit, fecha_aparicion: ts, fecha_cierre: ts }],
  ['alertas_plan', { patente: lit, codigo_tarea: lit, tipo: lit, fecha_generada: ts, fecha_revisada: ts }],
  ['alertas_falla', { patente: lit, codigo: lit, fecha_aparicion: ts, fecha_generada: ts, fecha_revisada: ts }],
  ['alertas_dispositivo', { device_uid: lit, fecha_generada: ts, fecha_revisada: ts }],
  ['kilometraje_historial', { patente: lit, fecha: ts, km: lit, fuente: lit, email_usuario: lit }],
];

const out: string[] = [
  '-- Sistema de Telemetría Vehicular — datos de ejemplo (DML)',
  '-- GENERADO por backend/scripts/seed.ts desde mock/data/db.json. No editar a mano.',
  '-- Fechas relativas al momento de la carga. Borra la flota; conserva usuarios y catálogo.',
  '',
  'begin;',
  "create temp table _ref on commit drop as select date_trunc('second', now()) as t, (now() at time zone 'America/Argentina/Buenos_Aires')::date as d;",
  `truncate ${TABLAS.map(([t]) => t).reverse().join(', ')}, lecturas;`,
  '',
  '-- Usuarios del mock (los services de ejemplo los referencian). No pisa usuarios existentes.',
  'insert into usuarios (email, nombre, rol, created_at) values',
  (db.usuarios ?? []).map((u) => `  (${lit(u.email)}, ${lit(u.nombre)}, ${lit(u.rol)}, ${ts(u.created_at)})`).join(',\n'),
  'on conflict (email) do nothing;',
];

for (const [tabla, cols] of TABLAS) {
  const filas = db[tabla] ?? [];
  if (!filas.length) continue;
  const nombres = Object.keys(cols);
  out.push('', `insert into ${tabla} (${nombres.join(', ')}) values`);
  out.push(filas.map((f) => `  (${nombres.map((c) => cols[c]!(f[c])).join(', ')})`).join(',\n') + ';');
}
out.push('', 'commit;', '');

const destino = path.join(raiz, 'db', 'seed.sql');
fs.writeFileSync(destino, out.join('\n'));
console.log(`Generado ${destino}`);

if (process.argv.includes('--cargar')) {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL (usar --env-file=.env).');
  const sql = crearSql(process.env.DATABASE_URL, { max: 1 }); // una conexión: el archivo trae su begin/commit
  await sql.unsafe(fs.readFileSync(destino, 'utf8'));
  await sql.end();
  console.log('Seed cargado.');
}