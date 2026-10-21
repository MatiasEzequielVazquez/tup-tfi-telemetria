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

export const normalizarPatente = (p: unknown) => String(p ?? '').toUpperCase().trim();
export const REGEX_PATENTE = /^[A-Z0-9]{6,10}$/;
export const REGEX_DEVICE_UID = /^[\w-]{3,50}$/;

/** Un parámetro de query como string, o undefined. */
export const query = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** Paginación del contrato: ?page=&page_size= (por defecto 1 y 20, máximo 100). */
export function paginacion(q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(query(q.page) ?? '', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query(q.page_size) ?? '', 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export const pagina = <T>(p: { page: number; pageSize: number }, data: T[], total: number) => ({
  data,
  page: p.page,
  page_size: p.pageSize,
  total,
});

/** Parámetro de ruta (:patente, :email…) como string. En Express 5 el tipo admite string[]. */
export function param(v: string | string[] | undefined): string {
  if (typeof v !== 'string' || v === '') throw validacion('Parámetro de ruta inválido.');
  return v;
}

export const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha 'YYYY-MM-DD' que existe en el calendario (rechaza 2026-02-30). */
export function esFechaValida(s: unknown): s is string {
  if (typeof s !== 'string' || !REGEX_FECHA.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Fecha de hoy ('YYYY-MM-DD') en la zona horaria del negocio, no en UTC.
 * Un service cargado a las 22 h en Argentina ya es "mañana" en UTC.
 */
export function hoyEn(zonaHoraria: string, instante = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

/** Filtro de período ?desde=&hasta= (YYYY-MM-DD, inclusivos). */
export function periodo(q: Record<string, unknown>): { desde?: string; hasta?: string } {
  const out: { desde?: string; hasta?: string } = {};
  for (const k of ['desde', 'hasta'] as const) {
    const v = query(q[k]);
    if (v === undefined) continue;
    if (!esFechaValida(v)) throw validacion(`${k} debe tener formato YYYY-MM-DD.`);
    out[k] = v;
  }
  return out;
}