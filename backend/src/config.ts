// Configuración del backend a partir de variables de entorno (ver backend/.env.example).

export type ModoAuth = 'supabase' | 'dev';

export interface Config {
  nodeEnv: string;
  produccion: boolean;
  port: number;
  corsOrigin: string[];
  databaseUrl: string;
  auth: {
    modo: ModoAuth;
    supabaseUrl: string;
    supabaseAnonKey: string;
    cacheSegundos: number;
  };
  reglas: {
    plazoSinReportarHoras: number;   // RN10
    temporizadorMinutos: number;     // M8
    zonaHoraria: string;             // define qué día es "hoy" para un service
    toleranciaFuturoMinutos: number; // mensajes MQTT con reloj adelantado
  };
  mqtt: {
    habilitado: boolean;
    url: string;
    username?: string;
    password?: string;
    topic: string;
    clientId: string;
  };
}

function entero(nombre: string, valor: string | undefined, porDefecto: number, min = 1): number {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`${nombre} debe ser un entero mayor o igual a ${min} (vino "${valor}").`);
  }
  return n;
}

export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const errores: string[] = [];
  const nodeEnv = env.NODE_ENV || 'development';
  const produccion = nodeEnv === 'production';

  const modo = (env.AUTH_MODE || (produccion ? 'supabase' : 'dev')) as ModoAuth;
  if (!['supabase', 'dev'].includes(modo)) errores.push('AUTH_MODE debe ser supabase o dev.');
  if (produccion && modo === 'dev') errores.push('AUTH_MODE=dev no está permitido con NODE_ENV=production.');

  if (!env.DATABASE_URL) errores.push('Falta DATABASE_URL.');
  if (modo === 'supabase') {
    if (!env.SUPABASE_URL) errores.push('Falta SUPABASE_URL (necesaria para validar las sesiones).');
    if (!env.SUPABASE_ANON_KEY) errores.push('Falta SUPABASE_ANON_KEY (necesaria para validar las sesiones).');
  }

    // Sin MQTT_BROKER_URL la ingesta queda deshabilitada y la API funciona igual.
  const mqttHabilitado = env.MQTT_HABILITADO ? env.MQTT_HABILITADO === 'true' : Boolean(env.MQTT_BROKER_URL);
  if (mqttHabilitado && !env.MQTT_BROKER_URL) errores.push('MQTT_HABILITADO=true pero falta MQTT_BROKER_URL.');

  let config: Config | undefined;
  try {
    config = {
      nodeEnv,
      produccion,
      port: entero('PORT', env.PORT, 3000),
      corsOrigin: (env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
      databaseUrl: env.DATABASE_URL ?? '',
      auth: {
        modo,
        supabaseUrl: (env.SUPABASE_URL ?? '').replace(/\/+$/, ''),
        supabaseAnonKey: env.SUPABASE_ANON_KEY ?? '',
        cacheSegundos: entero('AUTH_CACHE_SEGUNDOS', env.AUTH_CACHE_SEGUNDOS, 60, 0),
      },
      reglas: {
        plazoSinReportarHoras: entero('PLAZO_DISPOSITIVO_SIN_REPORTAR_HORAS', env.PLAZO_DISPOSITIVO_SIN_REPORTAR_HORAS, 24),
        temporizadorMinutos: entero('TEMPORIZADOR_INTERVALO_MINUTOS', env.TEMPORIZADOR_INTERVALO_MINUTOS, 5),
        zonaHoraria: env.ZONA_HORARIA || 'America/Argentina/Buenos_Aires',
        toleranciaFuturoMinutos: entero('TOLERANCIA_FUTURO_MINUTOS', env.TOLERANCIA_FUTURO_MINUTOS, 10, 0),
      },
      mqtt: {
        habilitado: mqttHabilitado,
        url: env.MQTT_BROKER_URL ?? '',
        username: env.MQTT_USERNAME || undefined,
        password: env.MQTT_PASSWORD || undefined,
        topic: env.MQTT_TOPIC_LECTURAS || 'telemetria/+/lecturas',
        // Fijo: con sesión persistente, el broker reconoce al backend por este id.
        clientId: env.MQTT_CLIENT_ID || 'tfi-backend',
      },
    };
  } catch (e) {
    errores.push((e as Error).message);
  }

  if (errores.length || !config) {
    throw new Error(`Configuración inválida:\n  - ${errores.join('\n  - ')}`);
  }
  return config;
}