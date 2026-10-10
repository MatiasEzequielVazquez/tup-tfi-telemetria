import { invalidResponse } from './client'

/**
 * Comprobaciones mínimas en el borde de la API. Los tipos generados desde OpenAPI no
 * validan nada en tiempo de ejecución: estas guardas aseguran la forma que la interfaz
 * necesita para no romperse (objetos, arreglos, números), no cada campo.
 */

export function expectRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse(`se esperaba un objeto en ${what}.`)
  }
  return value as Record<string, unknown>
}

export function expectArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw invalidResponse(`se esperaba una lista en ${what}.`)
  return value
}

export function expectNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidResponse(`se esperaba un número en ${what}.`)
  }
  return value
}

export function expectString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw invalidResponse(`se esperaba un texto en ${what}.`)
  return value
}
