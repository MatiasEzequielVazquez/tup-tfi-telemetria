import { describe, expect, it } from 'vitest'
import type { AdminUnit } from '../../../../../src/features/admin/types'
import {
  deviceStatusInfo,
  linkableUnits,
  unitOptionLabel,
  validateDeviceUid,
} from '../../../../../src/features/admin/utils/devices'

const unit = (patente: string, patch: Partial<AdminUnit> = {}) =>
  ({ patente, marca: 'Scania', modelo: 'R 450', activa: true, dispositivo: null, ...patch }) as AdminUnit

describe('validateDeviceUid', () => {
  it('acepta de 3 a 50 caracteres entre letras, números, guion y guion bajo', () => {
    for (const uid of ['esp32-0F3A21', 'ABC', 'a_b-c', 'x'.repeat(50), '  esp32-0F3A21  ']) {
      expect(validateDeviceUid(uid)).toBeNull()
    }
  })

  it('exige el identificador', () => {
    expect(validateDeviceUid('')).toMatch(/Ingresá el identificador/)
    expect(validateDeviceUid('   ')).toMatch(/Ingresá el identificador/)
  })

  it('rechaza lo muy corto, lo muy largo y los caracteres no admitidos', () => {
    for (const uid of ['ab', 'x'.repeat(51), 'esp32 0F3A21', 'esp32/0F3A21', 'esp32.0F3A21', 'ñandú-01']) {
      expect(validateDeviceUid(uid)).toMatch(/inválido/)
    }
  })
})

describe('linkableUnits (RN02)', () => {
  it('ofrece solo las unidades activas que no tienen dispositivo', () => {
    const units = [
      unit('LIBRE1'),
      unit('OCUPADA', { dispositivo: { device_uid: 'esp32-A1', estado: 'activo', ultima_comunicacion: null } }),
      unit('DEBAJA', { activa: false }),
      unit('LIBRE2'),
    ]

    expect(linkableUnits(units).map((u) => u.patente)).toEqual(['LIBRE1', 'LIBRE2'])
  })

  it('con una lista vacía no ofrece nada', () => {
    expect(linkableUnits([])).toEqual([])
  })
})

describe('unitOptionLabel', () => {
  it('muestra la patente con la marca y el modelo, si los hay', () => {
    expect(unitOptionLabel(unit('AB123CD'))).toBe('AB123CD · Scania R 450')
    expect(unitOptionLabel(unit('AB123CD', { modelo: null }))).toBe('AB123CD · Scania')
    expect(unitOptionLabel(unit('AB123CD', { marca: '', modelo: null }))).toBe('AB123CD')
  })
})

describe('deviceStatusInfo', () => {
  it('cada estado tiene texto, ícono y tono', () => {
    expect(deviceStatusInfo('activo')).toMatchObject({ label: 'Activo', tone: 'ok' })
    expect(deviceStatusInfo('inactivo')).toMatchObject({ label: 'Inactivo', tone: 'neutral' })
    expect(deviceStatusInfo('sin_reportar')).toMatchObject({ label: 'Sin reportar', tone: 'warn' })
  })
})
