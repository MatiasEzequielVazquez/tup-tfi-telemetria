// Procesa UN mensaje con el formato del firmware, directo contra la base (sin broker).
//   npx tsx --env-file=.env scripts/mensaje.ts --device esp32-B4D43E --km 537153 --horas 15320
// Opciones: --device (obligatoria) --km --horas --dtc CODIGO --dtc-off CODIGO
//           --timestamp ISO  o  --hace-min N   (por defecto, ahora)

import { parseArgs } from 'node:util';
import { crearSql } from '../src/db.js';
import { MensajeInvalido, parsearMensaje } from '../src/modulos/ingesta/parser.js';
import { procesarMensaje } from '../src/modulos/ingesta/procesador.js';

const { values: op } = parseArgs({
  options: {
    device: { type: 'string' },
    km: { type: 'string' },
    horas: { type: 'string' },
    dtc: { type: 'string', multiple: true },
    'dtc-off': { type: 'string', multiple: true },
    timestamp: { type: 'string' },
    'hace-min': { type: 'string' },
    protocolo: { type: 'string', default: 'J1939' },
  },
});
if (!op.device) throw new Error('Falta --device');
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL (usar --env-file=.env)');

const timestamp = op.timestamp ?? new Date(Date.now() - Number(op['hace-min'] ?? 0) * 60_000).toISOString();
const lecturas: unknown[] = [];
if (op.km) lecturas.push({ tipo: 'km', valor: Number(op.km), origen: { pgn: 65248 } });
if (op.horas) lecturas.push({ tipo: 'horas_motor', valor: Number(op.horas), origen: { pgn: 65253 } });
for (const c of op.dtc ?? []) lecturas.push({ tipo: 'dtc', codigo: c, activo: true, origen: { pgn: 'DM1' } });
for (const c of op['dtc-off'] ?? []) lecturas.push({ tipo: 'dtc', codigo: c, activo: false, origen: { pgn: 'DM1' } });

const payload = JSON.stringify({ device_uid: op.device, protocolo: op.protocolo, timestamp, lecturas });
console.log('Mensaje:', payload);

const sql = crearSql(process.env.DATABASE_URL, { max: 2 });
try {
  const msg = parsearMensaje(payload);
  if (msg.ignoradas.length) console.warn('Ignoradas:', msg.ignoradas);
  console.log('Resultado:', await procesarMensaje(sql, msg));
} catch (e) {
  console.error(e instanceof MensajeInvalido ? `Mensaje inválido: ${e.message}` : e);
} finally {
  await sql.end();
}