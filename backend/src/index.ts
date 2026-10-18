import { crearApp } from './app.js';
import { verificadorDev, verificadorSupabase } from './auth/verificadores.js';
import { cargarConfig, type Config } from './config.js';
import { crearSql } from './db.js';

// Punto de entrada: arranca la API. Después se suman la ingesta MQTT (M3) y el temporizador (M8).

let config: Config;
try {
  config = cargarConfig();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const sql = crearSql(config.databaseUrl);
try {
  await sql`select 1`;
} catch (e) {
  console.error(`No se pudo conectar a la base de datos: ${(e as Error).message}`);
  process.exit(1);
}

// Cómo se valida el token: contra Supabase Auth, o en modo dev (token = rol o email).
const verificar = config.auth.modo === 'dev' ? verificadorDev(sql) : verificadorSupabase(config.auth);
if (config.auth.modo === 'dev') console.warn('[auth] AUTH_MODE=dev: el token es el rol o el email. SOLO DESARROLLO.');

const app = crearApp({ sql, config, verificar });
const server = app.listen(config.port, () => {
  console.info(`API en http://localhost:${config.port}/api/v1 (${config.nodeEnv}, auth: ${config.auth.modo})`);
});

// Apagado prolijo: deja terminar las requests en curso y cierra las conexiones a la base.
async function apagar(senal: string) {
  console.info(`${senal}: cerrando…`);
  server.close();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));