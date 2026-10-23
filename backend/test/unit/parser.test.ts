import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MensajeInvalido, parsearMensaje } from '../../src/modulos/ingesta/parser.js';

const ahora = new Date('2026-10-13T12:00:00Z');
const parsear = (obj: unknown) => parsearMensaje(JSON.stringify(obj), { ahora });
const base = { device_uid: 'esp32-0F3A21', protocolo: 'J1939', timestamp: '2026-10-13T11:59:00Z' };

describe('parsearMensaje (contrato MQTT, 2ª entrega §3.2)', () => {
  it('interpreta el mensaje de ejemplo del contrato', () => {
    const m = parsear({
      ...base,
      lecturas: [
        { tipo: 'km', valor: 812430, origen: { pgn: 65248 } },
        { tipo: 'horas_motor', valor: 15320, origen: { pgn: 65253 } },
        { tipo: 'dtc', codigo: 'spn-100-fmi-3', activo: true, origen: { pgn: 'DM1' } },
      ],
    });
    assert.equal(m.device_uid, 'esp32-0F3A21');
    assert.equal(m.timestamp.toISOString(), '2026-10-13T11:59:00.000Z');
    assert.deepEqual(m.mediciones.map((x) => [x.tipo, x.valor]), [['km', 812430], ['horas_motor', 15320]]);
    assert.deepEqual(m.dtcs, [{ codigo: 'SPN-100-FMI-3', activo: true }]); // normaliza a mayúsculas
    assert.deepEqual(m.ignoradas, []);
  });

  it('acepta un mensaje sin lecturas (solo cuenta como comunicación)', () => {
    const m = parsear(base);
    assert.equal(m.mediciones.length + m.dtcs.length, 0);
  });

  it('ignora lecturas desconocidas o inválidas sin descartar el resto (RNF09)', () => {
    const m = parsear({ ...base, lecturas: [{ tipo: 'velocidad', valor: 80 }, { tipo: 'km', valor: -5 }, { tipo: 'km', valor: 1000 }, 'basura'] });
    assert.deepEqual(m.mediciones.map((x) => x.valor), [1000]);
    assert.equal(m.ignoradas.length, 3);
  });

  it('un DTC sin "activo" es activo; activo:false lo cierra (RN12)', () => {
    const m = parsear({ ...base, lecturas: [{ tipo: 'dtc', codigo: 'P0101' }, { tipo: 'dtc', codigo: 'P0300', activo: false }] });
    assert.deepEqual(m.dtcs, [{ codigo: 'P0101', activo: true }, { codigo: 'P0300', activo: false }]);
  });

  const invalidos: [string, string][] = [
    ['JSON inválido', '{no es json'],
    ['sin device_uid', JSON.stringify({ timestamp: base.timestamp })],
    ['timestamp inválido', JSON.stringify({ ...base, timestamp: 'ayer' })],
    ['timestamp en el futuro', JSON.stringify({ ...base, timestamp: '2026-10-13T13:00:00Z' })],
    ['protocolo desconocido', JSON.stringify({ ...base, protocolo: 'CAN' })],
    ['lecturas no es lista', JSON.stringify({ ...base, lecturas: {} })],
  ];
  for (const [caso, payload] of invalidos) {
    it(`rechaza: ${caso}`, () => {
      assert.throws(() => parsearMensaje(payload, { ahora }), MensajeInvalido);
    });
  }
});