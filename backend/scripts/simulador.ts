// Simulador de flota (propuesta §9.2): publica mensajes con el formato del firmware.
//   npm run simulador -- --intervalo 5 --rondas 10 --km-por-ronda 1500
// Opciones:
//   --modo mqtt|directo   mqtt (por defecto) publica en el broker; directo procesa contra la base
//   --dispositivos a,b    solo esos device_uid (por defecto, todos los vinculados)
//   --intervalo <seg>     entre rondas (10)          --rondas <n>   0 = sin fin (0)
//   --km-por-ronda <km>   avance por ronda (15)      --prob-falla   0..1 (0.02)

import { connect } from 'mqtt';
import { parseArgs } from 'node:util';
import { crearSql } from '../src/db.js';
import { parsearMensaje } from '../src/modulos/ingesta/parser.js';
import { procesarMensaje } from '../src/modulos/ingesta/procesador.js';

const { values: op } = parseArgs({
  options: {
    modo: { type: 'string', default: 'mqtt' },
    dispositivos: { type: 'string' },
    intervalo: { type: 'string', default: '10' },
    rondas: { type: 'string', default: '0' },
    'km-por-ronda': { type: 'string', default: '15' },
    'prob-falla': { type: 'string', default: '0.02' },
  },
});
const env = process.env;
if (!env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
if (op.modo === 'mqtt' && !env.MQTT_BROKER_URL) throw new Error('Falta MQTT_BROKER_URL (o usar --modo directo)');

const intervalo = Number(op.intervalo) * 1000;
const rondas = Number(op.rondas);
const kmPorRonda = Number(op['km-por-ronda']);
const probFalla = Number(op['prob-falla']);
const CODIGOS = { J1939: ['SPN-100-FMI-3', 'SPN-110-FMI-0', 'SPN-190-FMI-2'], J1979: ['P0101', 'P0217', 'P0420'] };

// Flota: dispositivos vinculados hoy, con el km y protocolo de su unidad.
const sql = crearSql(env.DATABASE_URL, { max: 2 });
let flota = await sql<{ device_uid: string; patente: string; protocolo: 'J1939' | 'J1979'; km: number }[]>`
  select v.device_uid, u.patente, u.protocolo, u.km_actual as km
    from vinculaciones v join unidades u using (patente)
   where v.hasta is null and u.activa order by v.device_uid`;
if (op.dispositivos) {
  const pedidos = op.dispositivos.split(',').map((s) => s.trim());
  flota = flota.filter((d) => pedidos.includes(d.device_uid));
}
if (!flota.length) throw new Error('No hay dispositivos vinculados para simular.');
const fallas = new Map<string, Set<string>>(flota.map((d) => [d.device_uid, new Set()]));

/** Un mensaje con el formato del contrato. El km avanza; cada tanto aparece o se cierra una falla. */
function mensaje(d: (typeof flota)[number]) {
  d.km = Math.round((d.km + kmPorRonda * (0.8 + Math.random() * 0.4)) * 10) / 10;
  const j1939 = d.protocolo === 'J1939';
  const lecturas: unknown[] = [
    { tipo: 'km', valor: d.km, origen: j1939 ? { pgn: 65248 } : { pid: '010D', metodo: 'integracion_velocidad' } },
  ];
  const abiertas = fallas.get(d.device_uid)!;
  if (Math.random() < probFalla) {
    const codigo = CODIGOS[d.protocolo][Math.floor(Math.random() * 3)]!;
    abiertas.add(codigo);
    lecturas.push({ tipo: 'dtc', codigo, activo: true });
  } else if (abiertas.size && Math.random() < 0.2) {
    const [codigo] = abiertas;
    abiertas.delete(codigo!);
    lecturas.push({ tipo: 'dtc', codigo, activo: false });
  }
  return { device_uid: d.device_uid, protocolo: d.protocolo, timestamp: new Date().toISOString(), lecturas };
}

// Envío: por el broker (camino real) o directo a la base.
let enviar: (m: ReturnType<typeof mensaje>) => Promise<string>;
let cerrar = async () => {};
if (op.modo === 'mqtt') {
  const client = connect(env.MQTT_BROKER_URL!, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    clientId: `tfi-simulador-${process.pid}`,
  });
  await new Promise<void>((ok, mal) => {
    client.once('connect', () => ok());
    client.once('error', mal);
  });
  const topic = (uid: string) => (env.MQTT_TOPIC_LECTURAS || 'telemetria/+/lecturas').replace('+', uid);
  enviar = async (m) => {
    await client.publishAsync(topic(m.device_uid), JSON.stringify(m), { qos: 1 });
    return 'publicado';
  };
  cerrar = async () => void (await client.endAsync());
} else {
  enviar = async (m) => (await procesarMensaje(sql, parsearMensaje(JSON.stringify(m)))).resultado;
}

console.log(`Simulando ${flota.length} dispositivo(s) en modo ${op.modo}. Ctrl+C para terminar.`);
let detenido = false;
process.on('SIGINT', () => (detenido = true));

for (let ronda = 1; !detenido && (!rondas || ronda <= rondas); ronda++) {
  for (const d of flota) {
    const m = mensaje(d);
    const dtc = m.lecturas.filter((l: any) => l.tipo === 'dtc').map((l: any) => `${l.codigo}${l.activo ? '' : ' (cierra)'}`);
    console.log(`[${ronda}] ${d.device_uid} ${d.patente} km=${d.km}${dtc.length ? ` dtc=${dtc.join(',')}` : ''} -> ${await enviar(m)}`);
  }
  if (!rondas || ronda < rondas) await new Promise((r) => setTimeout(r, intervalo));
}
await cerrar();
await sql.end();