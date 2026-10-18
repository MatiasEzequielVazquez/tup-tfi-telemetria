import { validacion } from './errores.js';

/** Body de un POST/PATCH: no confiamos en su forma hasta validarlo. */
export type Body = Record<string, unknown>;

export const ENUMS = {
  rol: ['admin', 'mantenimiento'],
  tenencia: ['propia', 'fletero'],
  protocolo: ['J1939', 'J1979'],
  motivo: ['falta_espacio', 'salida_urgente', 'otro'],
  tipoAlerta: ['tarea_proxima', 'tarea_vencida', 'falla_nueva', 'dispositivo_sin_reportar'],
} as const;

export const esNumero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export const esEnteroPositivo = (x: unknown): x is number => Number.isInteger(x) && (x as number) > 0;
export const esTexto = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';
const vacio = (v: unknown) => v === undefined || v === null || v === '';

export function exigirCampos(body: Body, campos: string[]): void {
  const faltan = campos.filter((c) => vacio(body[c]));
  if (faltan.length) throw validacion(`Faltan campos obligatorios: ${faltan.join(', ')}.`);
}

/** Valida que el valor sea uno de los permitidos. Después de llamarla, TS sabe que es de ese tipo. */
export function exigirEnum<T extends string>(campo: string, valor: unknown, valores: readonly T[]): asserts valor is T {
  if (!valores.includes(valor as T)) {
    throw validacion(`${campo} debe ser ${valores.join(', ').replace(/, ([^,]*)$/, ' o $1')}.`);
  }
}

/** Texto opcional: null si viene vacío; valida tipo y largo máximo. */
export function textoOpcional(campo: string, valor: unknown, max: number): string | null {
  if (vacio(valor)) return null;
  if (typeof valor !== 'string') throw validacion(`${campo} debe ser un texto.`);
  const t = valor.trim();
  if (t.length > max) throw validacion(`${campo} admite hasta ${max} caracteres.`);
  return t || null;
}

export function textoObligatorio(campo: string, valor: unknown, max: number): string {
  const t = textoOpcional(campo, valor, max);
  if (t === null) throw validacion(`Faltan campos obligatorios: ${campo}.`);
  return t;
}

export const REGEX_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;