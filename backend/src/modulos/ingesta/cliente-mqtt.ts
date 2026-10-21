import { connect } from 'mqtt';
import type { Config } from '../../config.js';
import type { Sql } from '../../db.js';
import { MensajeInvalido, parsearMensaje } from './parser.js';
import { procesarMensaje } from './procesador.js';

// M3 — Suscripción al broker. Proceso continuo que se reconecta solo (RNF01).
// Los mensajes se procesan de a uno y en orden de llegada: con 50 unidades a una lectura por
// minuto (RNF07) es menos de un mensaje por segundo, y así dos mensajes del mismo dispositivo
// nunca compiten por las mismas filas.

export interface EstadoIngesta {
  conectado: boolean;
  recibidos: number;
  procesados: number;
  descartados: number;
  errores: number;
  pendientes: number;
  ultimo_mensaje: string | null;
}

const TIMEOUT_MENSAJE_MS = 30_000;

/** Rechaza si la promesa no termina a tiempo (la cola de ese dispositivo sigue con el próximo). */
function conTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let id: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    id = setTimeout(() => rechazar(new Error(`el procesamiento superó ${ms / 1000} s`)), ms);
  });
  return Promise.race([p, limite]).finally(() => clearTimeout(id));
}

export function iniciarIngesta({ sql, config, conectar = connect }: { sql: Sql; config: Config; conectar?: typeof connect }) {
  const { url, username, password, topic, clientId } = config.mqtt;
  const estado: EstadoIngesta = { conectado: false, recibidos: 0, procesados: 0, descartados: 0, errores: 0, pendientes: 0, ultimo_mensaje: null };

  const client = conectar(url, {
    username,
    password,
    clientId,
    clean: false,           // sesión persistente: el broker guarda los mensajes si estamos caídos
    reconnectPeriod: 5000,  // RNF01
    connectTimeout: 15_000,
    keepalive: 60,
  });

  // Cola: cada mensaje espera a que termine el anterior.
  const colas = new Map<string, Promise<void>>();

  client.on('connect', () => {
    estado.conectado = true;
    console.info(`[mqtt] conectado a ${url}; suscribiendo a "${topic}"`);
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error('[mqtt] no se pudo suscribir:', err.message);
    });
  });
  client.on('reconnect', () => console.warn('[mqtt] reconectando…'));
  client.on('close', () => {
    if (estado.conectado) console.warn('[mqtt] conexión cerrada');
    estado.conectado = false;
  });
  client.on('error', (err) => console.error('[mqtt] error:', err.message));

  client.on('message', (t, payload) => {
    estado.recibidos++;
    estado.pendientes++;
    const instante = new Date();

    const anterior = colas.get(t) ?? Promise.resolve();
    const actual = anterior
      .then(() => conTimeout(manejar(t, payload, instante), TIMEOUT_MENSAJE_MS))
      .catch((e: Error) => {
        estado.errores++;
        console.error(`[mqtt] error en "${t}": ${e.message}`);
      })
      .finally(() => {
        estado.pendientes--;
      });
    colas.set(t, actual);
    // Si nadie más se encoló detrás, se libera la entrada del Map.
    void actual.then(() => {
      if (colas.get(t) === actual) colas.delete(t);
    });
  });

  async function manejar(t: string, payload: Buffer, instante: Date) {
    let msg;
    try {
      msg = parsearMensaje(payload, { ahora: instante, toleranciaFuturoMinutos: config.reglas.toleranciaFuturoMinutos });
    } catch (e) {
      if (!(e instanceof MensajeInvalido)) throw e;
      estado.descartados++;
      console.warn(`[mqtt] mensaje descartado en "${t}": ${e.message}`);
      return;
    }
    if (msg.ignoradas.length) console.warn(`[mqtt] ${msg.device_uid}: lecturas ignoradas: ${msg.ignoradas.join('; ')}`);

    try {
      const r = await procesarMensaje(sql, msg, { instante });
      estado.ultimo_mensaje = new Date().toISOString();
      if (r.resultado === 'procesado') {
        estado.procesados++;
        console.info(`[mqtt] ${r.device_uid} (${r.patente}): ${r.guardadas} lecturas${r.km_actualizado ? ', km actualizado' : ''}`
          + `${r.inconsistentes ? `, ${r.inconsistentes} inconsistente(s) (RN09)` : ''}`
          + `${r.fallas_abiertas ? `, ${r.fallas_abiertas} falla(s) nueva(s)` : ''}`);
      } else {
        estado.descartados++;
        console.warn(`[mqtt] ${msg.device_uid}: ${r.resultado === 'dispositivo_desconocido' ? 'dispositivo no registrado' : 'sin vinculación al momento de la lectura'}`);
      }
    } catch (e) {
      // Un error de base no tiene que tirar el proceso: se registra y se sigue con el próximo.
      estado.errores++;
      console.error(`[mqtt] error procesando mensaje de ${msg.device_uid}:`, (e as Error).message);
    }
  }

  return {
    estado: (): EstadoIngesta => ({ ...estado }),
    cerrar: () => new Promise<void>((resolve) => client.end(false, {}, () => void Promise.all(colas.values()).finally(resolve))),
  };
}