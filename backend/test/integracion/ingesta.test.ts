import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, before, describe, it } from 'node:test';
import type { connect } from 'mqtt';
import { iniciarIngesta } from '../../src/modulos/ingesta/cliente-mqtt.js';
import { parsearMensaje } from '../../src/modulos/ingesta/parser.js';
import { procesarMensaje } from '../../src/modulos/ingesta/procesador.js';
import { revisarDispositivos } from '../../src/modulos/temporizador/dispositivos.js';
import { SIN_DB, configTest, crearEntorno } from '../helpers.js';

// AP414XV: Scania J1939 con el dispositivo esp32-B4D43E.
const UID = 'esp32-B4D43E';
const PATENTE = 'AP414XV';
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

describe('Ingesta (M3) y temporizador (M8)', { skip: SIN_DB }, () => {
  let e: Awaited<ReturnType<typeof crearEntorno>>;
  before(async () => {
    e = await crearEntorno();
  });
  after(async () => {
    await e?.cerrar();
  });

  const procesar = (obj: object) => procesarMensaje(e.sql, parsearMensaje(JSON.stringify(obj)));
  const kmUnidad = async () => (await e.sql<{ km_actual: number; km_fuente: string }[]>`
    select km_actual, km_fuente from unidades where patente = ${PATENTE}`)[0]!;

  it('guarda lecturas, actualiza el km (odómetro en J1939) y la comunicación (RF04, RN08)', async () => {
    const { km_actual } = await kmUnidad();
    const r = await procesar({ device_uid: UID, timestamp: hace(5), lecturas: [{ tipo: 'km', valor: km_actual + 120 }, { tipo: 'horas_motor', valor: 15320 }] });
    assert.deepEqual([r.resultado, r.patente, r.guardadas, r.km_actualizado], ['procesado', PATENTE, 2, true]);
    assert.deepEqual(await kmUnidad(), { km_actual: km_actual + 120, km_fuente: 'odometro' });
  });

  it('un mensaje repetido no duplica lecturas (QoS 1)', async () => {
    const msg = { device_uid: UID, timestamp: hace(4), lecturas: [{ tipo: 'horas_motor', valor: 15321 }] };
    assert.equal((await procesar(msg)).guardadas, 1);
    const r = await procesar(msg);
    assert.deepEqual([r.guardadas, r.duplicadas], [0, 1]);
  });

  it('km que retrocede: inconsistente y no baja el km (RN09)', async () => {
    const { km_actual } = await kmUnidad();
    const r = await procesar({ device_uid: UID, timestamp: hace(3), lecturas: [{ tipo: 'km', valor: km_actual - 50 }] });
    assert.equal(r.inconsistentes, 1);
    assert.equal((await kmUnidad()).km_actual, km_actual);
  });

  it('lectura vieja que llega tarde: consistente, no baja el km (RNF02)', async () => {
    const { km_actual } = await kmUnidad();
    const r = await procesar({ device_uid: UID, timestamp: hace(30), lecturas: [{ tipo: 'km', valor: km_actual - 30 }] });
    assert.deepEqual([r.guardadas, r.inconsistentes], [1, 0]);
    assert.equal((await kmUnidad()).km_actual, km_actual);
  });

  it('fallas: abre con alerta, no duplica, cierra y reaparece (RN12)', async () => {
    const dtc = (activo: boolean, min: number) => ({ device_uid: UID, timestamp: hace(min), lecturas: [{ tipo: 'dtc', codigo: 'SPN-100-FMI-3', activo }] });
    assert.equal((await procesar(dtc(true, 1.5))).fallas_abiertas, 1);
    assert.equal((await procesar(dtc(true, 1))).fallas_abiertas, 0);
    assert.equal((await procesar(dtc(false, 0.5))).fallas_cerradas, 1);
    assert.equal((await procesar(dtc(true, 0.2))).fallas_abiertas, 1);
    const alertas = await e.api('GET', `/alertas?patente=${PATENTE}&tipo=falla_nueva&estado=abierta`);
    assert.equal(alertas.body.total, 2); // una por cada aparición
  });

  it('descarta dispositivos desconocidos', async () => {
    assert.equal((await procesar({ device_uid: 'esp32-NOEXISTE', timestamp: hace(1) })).resultado, 'dispositivo_desconocido');
  });

  it('temporizador: marca sin_reportar con una sola alerta; al volver a reportar pasa a activo (RN10)', async () => {
    await e.sql`update dispositivos set ultima_comunicacion = now() - interval '25 hours' where device_uid = ${UID}`;
    assert.ok((await revisarDispositivos(e.sql, 24)).includes(UID));
    assert.deepEqual(await revisarDispositivos(e.sql, 24), []); // la segunda pasada no repite
    const alertas = await e.api('GET', `/alertas?patente=${PATENTE}&tipo=dispositivo_sin_reportar&estado=abierta`);
    assert.equal(alertas.body.total, 1);

    await procesar({ device_uid: UID, timestamp: hace(0) });
    const [d] = await e.sql`select estado from dispositivos where device_uid = ${UID}`;
    assert.equal(d!.estado, 'activo');
  });

  it('cliente MQTT: suscribe con QoS 1 y sesión persistente; procesa y descarta sin caerse', async () => {
    // Cliente falso con la misma interfaz de eventos que mqtt.js: no hace falta broker.
    const fake = Object.assign(new EventEmitter(), {
      subscribe: (_t: string, _o: unknown, cb: (err: Error | null) => void) => cb(null),
      end: (_f: boolean, _o: unknown, cb: () => void) => cb(),
    });
    let opciones: { clean?: boolean } = {};
    const conectar = ((_url: string, opts: { clean?: boolean }) => {
      opciones = opts;
      return fake;
    }) as unknown as typeof connect;

    const ingesta = iniciarIngesta({ sql: e.sql, config: { ...configTest, mqtt: { ...configTest.mqtt, url: 'mqtt://falso' } }, conectar });
    fake.emit('connect');
    assert.equal(opciones.clean, false);

    fake.emit('message', 'telemetria/x/lecturas', Buffer.from('no es json'));
    fake.emit('message', `telemetria/${UID}/lecturas`, Buffer.from(JSON.stringify({ device_uid: UID, timestamp: hace(0), lecturas: [{ tipo: 'horas_motor', valor: 15500 }] })));
    fake.emit('message', 'telemetria/y/lecturas', Buffer.from(JSON.stringify({ device_uid: 'esp32-NOEXISTE', timestamp: hace(0) })));
    await ingesta.cerrar(); // espera que se vacíen las colas

    const est = ingesta.estado();
    assert.deepEqual([est.recibidos, est.procesados, est.descartados, est.errores, est.pendientes], [3, 1, 2, 0, 0]);
  });
});