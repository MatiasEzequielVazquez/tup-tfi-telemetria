// M3 — Interpretación del mensaje MQTT (contrato: 2ª entrega §3.2).
// Es el ÚNICO lugar del sistema que conoce el formato del firmware (RNF09).

export class MensajeInvalido extends Error {}

export interface Medicion {
  tipo: 'km' | 'horas_motor';
  valor: number;
  origen: Record<string, unknown>;
}
export interface Dtc {
  codigo: string;
  activo: boolean;
}
export interface Mensaje {
  device_uid: string;
  protocolo: 'J1939' | 'J1979' | null;
  timestamp: Date;
  mediciones: Medicion[];
  dtcs: Dtc[];
  ignoradas: string[];
}

const MAX_LECTURAS = 200;
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Valida y normaliza un mensaje; lanza MensajeInvalido si no se puede procesar.
 * Una lectura de tipo desconocido se ignora (queda en "ignoradas") sin descartar el resto:
 * así un firmware más nuevo no rompe la ingesta.
 */
export function parsearMensaje(
  payload: Buffer | string,
  { ahora = new Date(), toleranciaFuturoMinutos = 10 } = {},
): Mensaje {
  let m: unknown;
  try {
    m = JSON.parse(typeof payload === 'string' ? payload : payload.toString('utf8'));
  } catch {
    throw new MensajeInvalido('el payload no es JSON válido');
  }
  if (!esObjeto(m)) throw new MensajeInvalido('el payload debe ser un objeto JSON');

  if (typeof m.device_uid !== 'string' || !/^[\w-]{3,50}$/.test(m.device_uid)) {
    throw new MensajeInvalido('device_uid ausente o inválido');
  }
  if (m.protocolo !== undefined && m.protocolo !== 'J1939' && m.protocolo !== 'J1979') {
    throw new MensajeInvalido(`protocolo inválido: ${String(m.protocolo)}`);
  }
  // RNF02: vale la marca de tiempo del dispositivo, no la de recepción.
  const t = typeof m.timestamp === 'string' ? Date.parse(m.timestamp) : NaN;
  if (Number.isNaN(t)) throw new MensajeInvalido('timestamp ausente o no es ISO 8601');
  if (t > ahora.getTime() + toleranciaFuturoMinutos * 60_000) {
    throw new MensajeInvalido(`timestamp en el futuro (${String(m.timestamp)}): revisar el reloj del dispositivo`);
  }

  const crudas = m.lecturas ?? [];
  if (!Array.isArray(crudas)) throw new MensajeInvalido('lecturas debe ser una lista');
  if (crudas.length > MAX_LECTURAS) throw new MensajeInvalido(`demasiadas lecturas (máximo ${MAX_LECTURAS})`);

  const mediciones: Medicion[] = [];
  const dtcs: Dtc[] = [];
  const ignoradas: string[] = [];

  crudas.forEach((l: unknown, i) => {
    if (!esObjeto(l)) return void ignoradas.push(`lecturas[${i}]: no es un objeto`);
    const origen = esObjeto(l.origen) ? l.origen : {};

    if (l.tipo === 'km' || l.tipo === 'horas_motor') {
      if (typeof l.valor !== 'number' || !Number.isFinite(l.valor) || l.valor < 0 || l.valor >= 1e11) {
        return void ignoradas.push(`lecturas[${i}]: valor inválido para ${l.tipo}`);
      }
      // Si el mismo tipo viene dos veces, vale el último (la PK de lecturas no admite dos).
      const previa = mediciones.findIndex((x) => x.tipo === l.tipo);
      if (previa >= 0) mediciones.splice(previa, 1);
      mediciones.push({ tipo: l.tipo, valor: Math.round(l.valor * 10) / 10, origen });
    } else if (l.tipo === 'dtc') {
      if (typeof l.codigo !== 'string' || !l.codigo.trim() || l.codigo.length > 30) {
        return void ignoradas.push(`lecturas[${i}]: código de falla inválido`);
      }
      dtcs.push({ codigo: l.codigo.trim().toUpperCase(), activo: l.activo !== false });
    } else {
      ignoradas.push(`lecturas[${i}]: tipo desconocido "${String(l.tipo)}"`);
    }
  });

  return {
    device_uid: m.device_uid,
    protocolo: (m.protocolo as Mensaje['protocolo']) ?? null,
    timestamp: new Date(t),
    mediciones,
    dtcs,
    ignoradas,
  };
}