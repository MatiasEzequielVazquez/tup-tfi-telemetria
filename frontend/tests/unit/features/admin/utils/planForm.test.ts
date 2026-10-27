import { describe, expect, it } from 'vitest'
import type { CatalogTask, UnitPlan } from '../../../../../src/features/admin/types'
import {
  assignableTasks,
  buildAssignBody,
  buildEditPlanBody,
  emptyAssignValues,
  hasPlanChanges,
  planStatusInfo,
  planToValues,
  validateAssign,
  validateEditPlan,
  withTaskDefaults,
  type AssignFormValues,
} from '../../../../../src/features/admin/utils/planForm'

const task = (codigo: string, intervalo = 40000, umbral = 4000): CatalogTask => ({
  codigo,
  nombre: `Tarea ${codigo}`,
  intervalo_km_default: intervalo,
  umbral_aviso_km_default: umbral,
})
const plan = (codigo_tarea: string, patch: Partial<UnitPlan> = {}) =>
  ({ codigo_tarea, nombre: codigo_tarea, intervalo_km: 40000, umbral_aviso_km: 4000, estado: 'al_dia', ...patch }) as UnitPlan

const CURRENT_KM = 415000
const valid: AssignFormValues = { codigo: 'ACEITE_MOTOR', intervalo: '40000', umbral: '4000', kmUltimo: '' }

describe('assignableTasks', () => {
  it('ofrece solo las tareas del catálogo que la unidad todavía no tiene', () => {
    const catalog = [task('ACEITE_MOTOR'), task('SECADOR_AIRE'), task('ACEITE_CAJA')]

    expect(assignableTasks(catalog, [plan('SECADOR_AIRE')]).map((t) => t.codigo)).toEqual(['ACEITE_MOTOR', 'ACEITE_CAJA'])
  })

  it('con todas asignadas no ofrece ninguna, y sin plan ofrece todas', () => {
    expect(assignableTasks([task('A')], [plan('A')])).toEqual([])
    expect(assignableTasks([task('A'), task('B')], [])).toHaveLength(2)
  })
})

describe('withTaskDefaults', () => {
  it('al elegir una tarea propone su intervalo y su aviso por defecto, sin tocar el km', () => {
    const values = withTaskDefaults({ ...emptyAssignValues(), kmUltimo: '300000' }, task('SECADOR_AIRE', 100000, 5000))

    expect(values).toEqual({ codigo: 'SECADOR_AIRE', intervalo: '100000', umbral: '5000', kmUltimo: '300000' })
  })

  it('al volver a "sin elegir" limpia el código y los valores propuestos', () => {
    expect(withTaskDefaults({ ...valid, kmUltimo: '10' }, undefined)).toEqual({
      codigo: '',
      intervalo: '',
      umbral: '',
      kmUltimo: '10',
    })
  })
})

describe('validateAssign', () => {
  it('acepta una tarea con su intervalo y su aviso, sin km de último service', () => {
    expect(validateAssign(valid, CURRENT_KM)).toEqual({})
  })

  it('exige elegir la tarea', () => {
    expect(validateAssign({ ...valid, codigo: '' }, CURRENT_KM).codigo).toMatch(/Elegí una tarea/)
  })

  it('exige el intervalo y el aviso como enteros positivos', () => {
    expect(validateAssign({ ...valid, intervalo: '' }, CURRENT_KM).intervalo).toBeDefined()
    expect(validateAssign({ ...valid, intervalo: '0' }, CURRENT_KM).intervalo).toBeDefined()
    expect(validateAssign({ ...valid, umbral: '2.5' }, CURRENT_KM).umbral).toBeDefined()
  })

  it('el km del último service va de 0 al km actual, inclusive', () => {
    expect(validateAssign({ ...valid, kmUltimo: '0' }, CURRENT_KM)).toEqual({})
    expect(validateAssign({ ...valid, kmUltimo: '415000' }, CURRENT_KM)).toEqual({})
    expect(validateAssign({ ...valid, kmUltimo: '375000.5' }, CURRENT_KM)).toEqual({})
    expect(validateAssign({ ...valid, kmUltimo: '415001' }, CURRENT_KM).kmUltimo).toMatch(/mayor al kilometraje actual \(415\.000 km\)/)
    expect(validateAssign({ ...valid, kmUltimo: '-1' }, CURRENT_KM).kmUltimo).toMatch(/mayor o igual a 0/)
    expect(validateAssign({ ...valid, kmUltimo: 'abc' }, CURRENT_KM).kmUltimo).toMatch(/mayor o igual a 0/)
  })
})

describe('buildAssignBody', () => {
  it('envía la tarea con el intervalo y el aviso, y omite el km si no se informó', () => {
    expect(buildAssignBody({ ...valid, intervalo: ' 60000 ' })).toEqual({
      codigo_tarea: 'ACEITE_MOTOR',
      intervalo_km: 60000,
      umbral_aviso_km: 4000,
    })
  })

  it('envía el km del último service cuando se informó', () => {
    expect(buildAssignBody({ ...valid, kmUltimo: '375000' })).toMatchObject({ km_ultimo_service: 375000 })
  })
})

describe('edición de un plan', () => {
  const original = plan('ACEITE_MOTOR', { intervalo_km: 40000, umbral_aviso_km: 4000 })

  it('parte de los valores actuales del plan', () => {
    expect(planToValues(original)).toEqual({ intervalo: '40000', umbral: '4000' })
  })

  it('valida el intervalo y el aviso', () => {
    expect(validateEditPlan({ intervalo: '60000', umbral: '4000' })).toEqual({})
    expect(Object.keys(validateEditPlan({ intervalo: '', umbral: '0' })).sort()).toEqual(['intervalo', 'umbral'])
  })

  it('envía solo lo que cambió', () => {
    expect(buildEditPlanBody({ intervalo: '60000', umbral: '4000' }, original)).toEqual({ intervalo_km: 60000 })
    expect(buildEditPlanBody({ intervalo: '60000', umbral: '5000' }, original)).toEqual({
      intervalo_km: 60000,
      umbral_aviso_km: 5000,
    })
  })

  it('sin cambios no hay nada para guardar', () => {
    const body = buildEditPlanBody(planToValues(original), original)
    expect(body).toEqual({})
    expect(hasPlanChanges(body)).toBe(false)
    expect(hasPlanChanges({ umbral_aviso_km: 1 })).toBe(true)
  })
})

describe('planStatusInfo', () => {
  it('cada estado tiene texto, ícono y tono', () => {
    expect(planStatusInfo('al_dia')).toMatchObject({ label: 'Al día', tone: 'ok' })
    expect(planStatusInfo('proxima')).toMatchObject({ label: 'Próxima', tone: 'warn' })
    expect(planStatusInfo('vencida')).toMatchObject({ label: 'Vencida', tone: 'danger' })
    expect(planStatusInfo('postergada')).toMatchObject({ label: 'Postergada', tone: 'postponed' })
  })
})
