import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alertaPorEstado, evaluarPlan } from '../../src/modulos/mantenimiento/reglas.js';

const plan = { km_ultimo_service: 100_000, intervalo_km: 40_000, umbral_aviso_km: 4_000 };

describe('evaluarPlan (RN04, RN05, RN07)', () => {
  it('al día cuando faltan más km que el umbral', () => {
    assert.deepEqual(evaluarPlan(plan, 120_000, null), { estado: 'al_dia', km_limite: 140_000 });
  });

  it('justo en el umbral sigue al día (faltan exactamente 4.000)', () => {
    assert.equal(evaluarPlan(plan, 136_000, null).estado, 'al_dia');
  });

  it('próxima cuando faltan menos km que el umbral (RN05)', () => {
    assert.equal(evaluarPlan(plan, 136_001, null).estado, 'proxima');
  });

  it('vencida al alcanzar o superar último service + intervalo (RN04)', () => {
    assert.equal(evaluarPlan(plan, 140_000, null).estado, 'vencida');
    assert.equal(evaluarPlan(plan, 150_000, null).estado, 'vencida');
  });

  it('postergada usa el nuevo límite y vuelve a vencida al superarlo (RN07)', () => {
    const post = { km_limite_nuevo: 145_000 };
    assert.deepEqual(evaluarPlan(plan, 142_000, post), { estado: 'postergada', km_limite: 145_000 });
    assert.equal(evaluarPlan(plan, 145_000, post).estado, 'postergada'); // en el límite: todavía no
    assert.equal(evaluarPlan(plan, 145_001, post).estado, 'vencida');
  });

  it('solo próxima y vencida generan alerta (RF12)', () => {
    assert.equal(alertaPorEstado('proxima'), 'tarea_proxima');
    assert.equal(alertaPorEstado('vencida'), 'tarea_vencida');
    assert.equal(alertaPorEstado('al_dia'), null);
    assert.equal(alertaPorEstado('postergada'), null);
  });
});