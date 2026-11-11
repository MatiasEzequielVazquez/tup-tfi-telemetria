import type { Alerta, Unidad } from '../../../../src/features/analytics/types'

export const unit = (overrides: Partial<Unidad> = {}): Unidad => ({
  patente: 'AB123CD',
  marca: 'Scania',
  modelo: 'R 450',
  anio: 2021,
  tenencia: 'propia',
  titular: null,
  protocolo: 'J1939',
  km_actual: 1000,
  km_fuente: 'odometro',
  activa: true,
  estado_mantenimiento: 'al_dia',
  fallas_activas: 0,
  dispositivo: { device_uid: 'esp32-AAAAAA', estado: 'activo', ultima_comunicacion: '2026-11-09T12:00:00Z' },
  ...overrides,
})

export const alert = (overrides: Partial<Alerta> = {}): Alerta => ({
  origen: 'plan',
  tipo: 'tarea_proxima',
  patente: 'AB123CD',
  referencia: 'ACEITE_MOTOR',
  referencia_nombre: 'Cambio de aceite de motor',
  fecha_generada: '2026-11-09T12:00:00Z',
  fecha_revisada: null,
  estado: 'abierta',
  clave: {},
  ...overrides,
})
