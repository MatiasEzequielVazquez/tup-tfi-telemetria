import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { SIN_DB, crearEntorno, hoyAR } from '../helpers.js';

describe('API REST', { skip: SIN_DB }, () => {
  let e: Awaited<ReturnType<typeof crearEntorno>>;
  before(async () => {
    e = await crearEntorno();
  });
  after(async () => {
    await e?.cerrar();
  });

  describe('M1 — sesión y roles (RF01, RN11)', () => {
    it('401 sin token o con token inválido; 403 si el email no está habilitado', async () => {
      assert.equal((await e.api('GET', '/me', { token: null })).status, 401);
      assert.equal((await e.api('GET', '/me', { token: 'basura' })).status, 401);
      const r = await e.api('GET', '/me', { token: 'intruso@otro.example' });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'usuario_no_habilitado');
    });

    it('/me devuelve el usuario y su rol', async () => {
      const r = await e.api('GET', '/me', { token: 'mantenimiento' });
      assert.deepEqual(r.body, { email: 'carlos.ibarra@flota.example', nombre: 'Carlos Ibarra', rol: 'mantenimiento' });
    });

    it('mantenimiento no accede a operaciones de admin', async () => {
      const casos: [string, string, unknown?][] = [
        ['GET', '/usuarios'],
        ['GET', '/dispositivos'],
        ['POST', '/unidades', { patente: 'ZZ999ZZ', marca: 'X', tenencia: 'propia', protocolo: 'J1939' }],
        ['POST', '/tareas-catalogo', { codigo: 'X1', nombre: 'x', intervalo_km_default: 1 }],
        ['DELETE', '/unidades/AP414XV'],
      ];
      for (const [metodo, ruta, body] of casos) {
        const r = await e.api(metodo, ruta, { token: 'mantenimiento', body });
        assert.equal(r.status, 403, `${metodo} ${ruta}`);
      }
    });

    it('alta de usuario normaliza el email; duplicado da 409', async () => {
      const r = await e.api('POST', '/usuarios', { body: { email: 'Ana@Flota.example', rol: 'mantenimiento' } });
      assert.equal(r.status, 201);
      assert.equal(r.body.email, 'ana@flota.example');
      assert.equal((await e.api('POST', '/usuarios', { body: { email: 'ana@flota.example', rol: 'admin' } })).status, 409);
    });
  });

  describe('M2/M9 — flota, unidades y dispositivos (RF02, RF03, RF14, RN02)', () => {
    const patentes = async (q: string) =>
      (await e.api('GET', `/unidades?page_size=100&${q}`)).body.data.map((u: { patente: string }) => u.patente).sort();

    it('vista de flota paginada y filtros contra el seed', async () => {
      const r = await e.api('GET', '/unidades?page_size=2');
      assert.deepEqual([r.body.total, r.body.data.length], [21, 2]);
      assert.deepEqual(await patentes('estado=vencida'), ['HC176VH', 'PT235CX', 'YH604TT']);
      assert.deepEqual(await patentes('estado=sin_dispositivo'), ['KX324HU', 'RU206LB', 'XD891JD']);
      assert.deepEqual(await patentes('activa=false'), ['CJ411PJ']);
      assert.equal((await e.api('GET', '/unidades?estado=raro')).status, 400);
    });

    it('alta, duplicado y baja lógica; no se da de baja con dispositivo', async () => {
      const alta = await e.api('POST', '/unidades', { body: { patente: 'ab123cd', marca: 'Scania', tenencia: 'fletero', protocolo: 'J1939' } });
      assert.equal(alta.status, 201);
      assert.deepEqual([alta.body.patente, alta.body.km_actual, alta.body.km_fuente], ['AB123CD', 0, 'manual']);
      assert.equal((await e.api('POST', '/unidades', { body: { patente: 'AB123CD', marca: 'X', tenencia: 'propia', protocolo: 'J1939' } })).status, 409);
      assert.equal((await e.api('DELETE', '/unidades/AP414XV')).status, 409);
      assert.equal((await e.api('DELETE', '/unidades/AB123CD')).body.activa, false);
    });

    it('vinculación respeta RN02 y conserva el historial', async () => {
      assert.equal((await e.api('POST', '/dispositivos', { body: { device_uid: 'esp32-TEST1' } })).status, 201);
      assert.equal((await e.api('PATCH', '/dispositivos/esp32-TEST1/vincular', { body: { patente: 'AP414XV' } })).status, 409);
      assert.equal((await e.api('PATCH', '/dispositivos/esp32-TEST1/vincular', { body: { patente: 'KX324HU' } })).status, 200);
      assert.equal((await e.api('PATCH', '/dispositivos/esp32-TEST1/vincular', { body: { patente: 'RU206LB' } })).status, 409);
      assert.equal((await e.api('PATCH', '/dispositivos/esp32-TEST1/desvincular')).status, 200);
      assert.equal((await e.api('PATCH', '/dispositivos/esp32-TEST1/vincular', { body: { patente: 'RU206LB' } })).status, 200);
      const hist = await e.sql`select patente from vinculaciones where device_uid = 'esp32-TEST1' order by desde`;
      assert.deepEqual(hist.map((h) => h.patente), ['KX324HU', 'RU206LB']);
    });

    it('detalle consolidado (RF15)', async () => {
      const r = await e.api('GET', '/unidades/mj539wd/detalle');
      assert.equal(r.body.unidad.patente, 'MJ539WD');
      assert.ok(r.body.dispositivo.desde);
      assert.ok(r.body.planes.length > 0);
      assert.ok(r.body.fallas_activas.every((f: { estado: string }) => f.estado === 'activo'));
      assert.equal((await e.api('GET', '/unidades/NOEXISTE/detalle')).status, 404);
    });
  });

  describe('M4 — planes y recálculo (RF07, RF08, RF12)', () => {
    it('plan nuevo toma el km actual; bajar el intervalo lo pasa a próxima y genera UNA alerta', async () => {
      const r = await e.api('POST', '/unidades/NP773EG/planes', { body: { codigo_tarea: 'ACEITE_MOTOR' } });
      assert.equal(r.status, 201);
      assert.equal(r.body.estado, 'al_dia');
      assert.equal(r.body.km_restantes, 40000);

      assert.equal((await e.api('PATCH', '/unidades/NP773EG/planes/ACEITE_MOTOR', { body: { intervalo_km: 3000 } })).body.estado, 'proxima');
      await e.api('PATCH', '/unidades/NP773EG/planes/ACEITE_MOTOR', { body: { intervalo_km: 2500 } }); // sigue en próxima
      const alertas = await e.api('GET', '/alertas?patente=NP773EG');
      assert.equal(alertas.body.total, 1); // solo en la transición
    });
  });

  describe('M5 — services y postergaciones (RF09, RF10, RN06, RN07)', () => {
    it('validaciones del service', async () => {
      for (const body of [{ km: 1, tareas: [] }, { km: 1, tareas: ['ACEITE_MOTOR'], fecha: '2999-01-01' }, { km: -1, tareas: ['ACEITE_MOTOR'] }]) {
        assert.equal((await e.api('POST', '/unidades/HC176VH/services', { token: 'mantenimiento', body })).status, 400, JSON.stringify(body));
      }
    });

    it('el service reinicia el plan, cierra la postergación y actualiza el km (RN06, RN08)', async () => {
      const antes = (await e.api('GET', '/unidades/KX324HU/detalle')).body;
      assert.equal(antes.planes.find((p: { codigo_tarea: string }) => p.codigo_tarea === 'ACEITE_CAJA').estado, 'postergada');

      const km = antes.unidad.km_actual + 150;
      const r = await e.api('POST', '/unidades/KX324HU/services', { token: 'mantenimiento', body: { km, tareas: ['ACEITE_CAJA'] } });
      assert.equal(r.status, 201);
      assert.equal(r.body.fecha, hoyAR());
      assert.equal(r.body.email_usuario, 'carlos.ibarra@flota.example');

      const despues = (await e.api('GET', '/unidades/KX324HU/detalle')).body;
      const caja = despues.planes.find((p: { codigo_tarea: string }) => p.codigo_tarea === 'ACEITE_CAJA');
      assert.deepEqual([caja.estado, caja.km_ultimo_service, caja.postergacion_vigente], ['al_dia', km, null]);
      assert.equal(despues.unidad.km_actual, km);
      assert.equal((await e.api('POST', '/unidades/KX324HU/services', { body: { km, tareas: ['ACEITE_MOTOR'] } })).status, 409);
    });

    it('postergar exige descripción con "otro" y vuelve a vencer al superar el límite (RN07)', async () => {
      const u = (await e.api('GET', '/unidades/HC176VH')).body;
      const ruta = '/unidades/HC176VH/planes/ACEITE_MOTOR/postergaciones';
      assert.equal((await e.api('POST', ruta, { body: { motivo: 'otro', km_limite_nuevo: u.km_actual + 4000 } })).status, 400);
      assert.equal((await e.api('POST', ruta, { body: { motivo: 'falta_espacio', km_limite_nuevo: u.km_actual } })).status, 400);

      const p = await e.api('POST', ruta, { body: { motivo: 'otro', motivo_descripcion: ' Esperando repuesto ', km_limite_nuevo: u.km_actual + 4000 } });
      assert.equal(p.status, 201);
      assert.equal(p.body.motivo_descripcion, 'Esperando repuesto');
      const plan = () => e.api('GET', '/unidades/HC176VH/planes').then((r) => r.body.data.find((x: { codigo_tarea: string }) => x.codigo_tarea === 'ACEITE_MOTOR'));
      assert.equal((await plan()).estado, 'postergada');

      await e.api('POST', '/unidades/HC176VH/kilometraje', { body: { km: u.km_actual + 4001 } });
      assert.equal((await plan()).estado, 'vencida');
    });
  });

  describe('M7/M9 — alertas y kilometraje (RF06, RF13, RN09)', () => {
    it('el km manual no puede disminuir (RN09)', async () => {
      const u = (await e.api('GET', '/unidades/RU206LB')).body;
      assert.equal((await e.api('POST', '/unidades/RU206LB/kilometraje', { body: { km: u.km_actual - 1 } })).status, 409);
      assert.equal((await e.api('POST', '/unidades/RU206LB/kilometraje', { token: 'mantenimiento', body: { km: u.km_actual + 1 } })).status, 201);
    });

    it('revisar una alerta de cada origen, de forma idempotente', async () => {
      const abiertas = (await e.api('GET', '/alertas?estado=abierta&page_size=100')).body.data;
      for (const origen of ['plan', 'falla', 'dispositivo']) {
        const a = abiertas.find((x: { origen: string }) => x.origen === origen);
        assert.ok(a, `hay una alerta abierta de origen ${origen}`);
        const r1 = await e.api('PATCH', '/alertas/revisar', { token: 'mantenimiento', body: { origen, ...a.clave } });
        assert.equal(r1.status, 200);
        assert.equal(r1.body.estado, 'revisada');
        const r2 = await e.api('PATCH', '/alertas/revisar', { body: { origen, ...a.clave } });
        assert.equal(r2.body.fecha_revisada, r1.body.fecha_revisada);
      }
    });
  });

  describe('Errores generales', () => {
    it('JSON inválido, body que no es objeto y ruta inexistente', async () => {
      assert.equal((await e.api('POST', '/unidades/AP414XV/kilometraje', { body: '{malo' })).status, 400);
      assert.equal((await e.api('POST', '/unidades/AP414XV/kilometraje', { body: [1, 2] })).status, 400);
      assert.equal((await e.api('GET', '/no-existe')).status, 404);
    });
  });
});