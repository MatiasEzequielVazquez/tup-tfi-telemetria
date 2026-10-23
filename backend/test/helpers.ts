// Entorno de pruebas: una base PostgreSQL temporal con schema.sql + seed.sql y la app levantada.
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from '../src/app.js';
import { verificadorDev } from '../src/auth/verificadores.js';
import type { Config } from '../src/config.js';
import { crearSql } from '../src/db.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (archivo: string) => fs.readFileSync(path.join(RAIZ, 'db', archivo), 'utf8');

/** Para describe(..., { skip: SIN_DB }): saltea los tests de integración si no hay Postgres local. */
export const SIN_DB = process.env.TEST_DATABASE_URL
  ? false
  : 'falta TEST_DATABASE_URL (levantar: docker compose -f docker-compose.dev.yml up -d)';

export const configTest: Config = {
  nodeEnv: 'test',
  produccion: false,
  port: 0,
  corsOrigin: ['http://localhost:5173'],
  databaseUrl: '',
  auth: { modo: 'dev', supabaseUrl: '', supabaseAnonKey: '', cacheSegundos: 0 },
  mqtt: { habilitado: false, url: '', topic: 'telemetria/+/lecturas', clientId: 'test' },
  reglas: { plazoSinReportarHoras: 24, temporizadorMinutos: 5, zonaHoraria: 'America/Argentina/Buenos_Aires', toleranciaFuturoMinutos: 10 },
};

export async function crearEntorno() {
  const adminUrl = process.env.TEST_DATABASE_URL!;
  const nombre = `tfi_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = crearSql(adminUrl, { max: 1 });
  await admin.unsafe(`create database ${nombre}`);

  const url = new URL(adminUrl);
  url.pathname = `/${nombre}`;
  // Una sola conexión para la carga: seed.sql trae su propio begin/commit.
  const setup = crearSql(url.toString(), { max: 1 });
  await setup.unsafe(leer('schema.sql'));
  await setup.unsafe(leer('seed.sql'));
  await setup.end();

  const sql = crearSql(url.toString(), { max: 5 });
  const app = crearApp({ sql, config: configTest, verificar: verificadorDev(sql) });
  const server: Server = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s)); // puerto 0: el sistema elige uno libre
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  /** Cliente HTTP mínimo. token: rol o email (AUTH_MODE=dev); null = sin header. */
  async function api(metodo: string, ruta: string, { token = 'admin', body }: { token?: string | null; body?: unknown } = {}) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + ruta, {
      method: metodo,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const texto = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (texto ? JSON.parse(texto) : null) as any };
  }

  async function cerrar() {
    await new Promise((ok) => server.close(ok));
    await sql.end({ timeout: 2 });
    await admin.unsafe(`drop database if exists ${nombre} with (force)`);
    await admin.end({ timeout: 2 });
  }

  return { sql, api, base, cerrar };
}

/** Fecha de hoy en Argentina, como la calcula el backend para los services. */
export const hoyAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());