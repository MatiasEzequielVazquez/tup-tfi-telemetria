#!/usr/bin/env node
'use strict';
// API mock del backend (contrato: docs/prototipo-backend.md y docs/openapi.yaml).
// Sin dependencias: solo Node >= 18. El estado vive en memoria; se reinicia con POST /__mock/reset.
//
//   node server.js
//   PORT=3000 MOCK_DELAY_MS=300 STRICT_AUTH=1 node server.js

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { ORDEN_CRITICIDAD, redondear, postergacionAbierta, evaluarPlan } = require('./logic');

const PORT = Number(process.env.PORT || 3000);
const BASE = '/api/v1';
const DELAY = Number(process.env.MOCK_DELAY_MS || 0);
const STRICT = process.env.STRICT_AUTH === '1';
const SEED = path.join(__dirname, 'data', 'db.json');

let db;
const cargarSeed = () => {
  db = JSON.parse(fs.readFileSync(SEED, 'utf8'));
};
cargarSeed();

// ---------- errores y helpers ----------
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const err400 = (m) => new HttpError(400, 'validacion', m);
const err404 = (m) => new HttpError(404, 'no_encontrado', m);
const err409 = (m) => new HttpError(409, 'conflicto', m);

const ok = (body) => ({ status: 200, body });
const creado = (body) => ({ status: 201, body });

const ahora = () => new Date().toISOString();
const hoy = () => ahora().slice(0, 10);
const esNum = (x) => typeof x === 'number' && Number.isFinite(x);
const esEntPos = (x) => Number.isInteger(x) && x > 0;
const esTexto = (x) => typeof x === 'string' && x.trim() !== '';
const ENUMS = {
  tenencia: ['propia', 'fletero'],
  protocolo: ['J1939', 'J1979'],
  rol: ['admin', 'mantenimiento'],
  motivo: ['falta_espacio', 'salida_urgente', 'otro'],
};
const enumOk = (campo, v) => ENUMS[campo].includes(v);

function paginar(items, q) {
  const page = Math.max(1, parseInt(q.get('page'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('page_size'), 10) || 20));
  return { data: items.slice((page - 1) * pageSize, page * pageSize), page, page_size: pageSize, total: items.length };
}

// Filtro por período sobre un campo de fecha (acepta YYYY-MM-DD o ISO), con ?desde= y ?hasta= inclusivos.
function filtrarPeriodo(items, campo, q) {
  const desde = q.get('desde');
  const hasta = q.get('hasta');
  return items.filter((x) => {
    const f = x[campo].slice(0, 10);
    return (!desde || f >= desde.slice(0, 10)) && (!hasta || f <= hasta.slice(0, 10));
  });
}

// ---------- autenticación simulada ----------
// Bearer admin | Bearer mantenimiento | Bearer <email de un usuario> | cualquier otro token (ej. JWT real de Supabase) -> admin.
// Sin header: admin, salvo STRICT_AUTH=1 (401).
function resolverUsuario(req) {
  const admin = db.usuarios.find((u) => u.rol === 'admin');
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) {
    if (STRICT) throw new HttpError(401, 'no_autenticado', 'Falta el header Authorization: Bearer <token>.');
    return admin;
  }
  const token = m[1].trim();
  if (token === 'admin' || token === 'mantenimiento') return db.usuarios.find((u) => u.rol === token);
  const porEmail = db.usuarios.find((u) => u.email === token);
  if (porEmail) return porEmail;
  if (STRICT) throw new HttpError(401, 'no_autenticado', 'Token inválido.');
  return admin;
}

// ---------- vistas ----------
const unidadPorPatente = (p) => db.unidades.find((u) => u.patente === p);
const getUnidad = (p) => {
  const u = unidadPorPatente(String(p).toUpperCase());
  if (!u) throw err404(`No existe la unidad ${p}.`);
  return u;
};
const nombreTarea = (codigo) => (db.tareas_catalogo.find((t) => t.codigo === codigo) || {}).nombre || codigo;
const nombreUsuario = (email) => (db.usuarios.find((u) => u.email === email) || {}).nombre || null;

function dispositivoDeUnidad(patente) {
  const v = db.vinculaciones.find((x) => x.patente === patente && !x.hasta);
  if (!v) return null;
  const d = db.dispositivos.find((x) => x.device_uid === v.device_uid);
  return { device_uid: d.device_uid, estado: d.estado, ultima_comunicacion: d.ultima_comunicacion, desde: v.desde };
}

function resumenUnidad(u) {
  const planes = db.planes_mantenimiento.filter((p) => p.patente === u.patente);
  const disp = dispositivoDeUnidad(u.patente);
  return {
    patente: u.patente,
    marca: u.marca,
    modelo: u.modelo,
    anio: u.anio,
    tenencia: u.tenencia,
    titular: u.titular,
    protocolo: u.protocolo,
    km_actual: u.km_actual,
    km_fuente: u.km_fuente,
    activa: u.activa,
    estado_mantenimiento: planes.length ? ORDEN_CRITICIDAD.find((e) => planes.some((p) => p.estado === e)) : null,
    fallas_activas: db.fallas.filter((f) => f.patente === u.patente && !f.fecha_cierre).length,
    dispositivo: disp && { device_uid: disp.device_uid, estado: disp.estado, ultima_comunicacion: disp.ultima_comunicacion },
  };
}

function vistaPlan(plan) {
  const u = unidadPorPatente(plan.patente);
  const post = postergacionAbierta(db, plan.patente, plan.codigo_tarea);
  const ev = evaluarPlan(plan, u.km_actual, post);
  return {
    codigo_tarea: plan.codigo_tarea,
    nombre: nombreTarea(plan.codigo_tarea),
    intervalo_km: plan.intervalo_km,
    umbral_aviso_km: plan.umbral_aviso_km,
    km_ultimo_service: plan.km_ultimo_service,
    km_limite: ev.km_limite,
    km_restantes: redondear(ev.km_limite - u.km_actual),
    estado: plan.estado,
    postergacion_vigente: post && {
      fecha: post.fecha,
      motivo: post.motivo,
      motivo_descripcion: post.motivo_descripcion,
      km_limite_nuevo: post.km_limite_nuevo,
      email_usuario: post.email_usuario,
    },
  };
}
const ordenTarea = (codigo) => db.tareas_catalogo.findIndex((t) => t.codigo === codigo);
const planesDe = (patente) =>
  db.planes_mantenimiento
    .filter((p) => p.patente === patente)
    .sort((a, b) => ordenTarea(a.codigo_tarea) - ordenTarea(b.codigo_tarea))
    .map(vistaPlan);

const vistaFalla = (f) => ({
  codigo: f.codigo,
  fecha_aparicion: f.fecha_aparicion,
  fecha_cierre: f.fecha_cierre,
  estado: f.fecha_cierre ? 'inactivo' : 'activo',
});

const vistaService = (s) => ({
  patente: s.patente,
  fecha: s.fecha,
  km: s.km,
  observaciones: s.observaciones,
  email_usuario: s.email_usuario,
  usuario_nombre: nombreUsuario(s.email_usuario),
  tareas: db.service_tareas
    .filter((t) => t.patente === s.patente && t.fecha === s.fecha)
    .map((t) => ({ codigo_tarea: t.codigo_tarea, nombre: nombreTarea(t.codigo_tarea) })),
});

const vistaPostergacion = (p) => ({
  patente: p.patente,
  codigo_tarea: p.codigo_tarea,
  tarea_nombre: nombreTarea(p.codigo_tarea),
  fecha: p.fecha,
  motivo: p.motivo,
  motivo_descripcion: p.motivo_descripcion,
  km_limite_nuevo: p.km_limite_nuevo,
  email_usuario: p.email_usuario,
  usuario_nombre: nombreUsuario(p.email_usuario),
  cerrada: p.cerrada,
});

function vistaDispositivo(d) {
  const v = db.vinculaciones.find((x) => x.device_uid === d.device_uid && !x.hasta);
  return {
    device_uid: d.device_uid,
    estado: d.estado,
    ultima_comunicacion: d.ultima_comunicacion,
    created_at: d.created_at,
    vinculacion_actual: v ? { patente: v.patente, desde: v.desde } : null,
  };
}

// Vista unificada de alertas (equivale a la vista SQL "alertas" + la clave para marcarlas como revisadas).
function todasLasAlertas() {
  const estado = (a) => (a.fecha_revisada ? 'revisada' : 'abierta');
  const out = [];
  for (const a of db.alertas_plan) {
    out.push({
      origen: 'plan',
      tipo: a.tipo,
      patente: a.patente,
      referencia: a.codigo_tarea,
      referencia_nombre: nombreTarea(a.codigo_tarea),
      fecha_generada: a.fecha_generada,
      fecha_revisada: a.fecha_revisada,
      estado: estado(a),
      clave: { patente: a.patente, codigo_tarea: a.codigo_tarea, tipo: a.tipo, fecha_generada: a.fecha_generada },
    });
  }
  for (const a of db.alertas_falla) {
    out.push({
      origen: 'falla',
      tipo: 'falla_nueva',
      patente: a.patente,
      referencia: a.codigo,
      referencia_nombre: null,
      fecha_generada: a.fecha_generada,
      fecha_revisada: a.fecha_revisada,
      estado: estado(a),
      clave: { patente: a.patente, codigo: a.codigo, fecha_aparicion: a.fecha_aparicion },
    });
  }
  for (const a of db.alertas_dispositivo) {
    const v = db.vinculaciones.find(
      (x) => x.device_uid === a.device_uid && a.fecha_generada >= x.desde && (!x.hasta || a.fecha_generada < x.hasta),
    );
    out.push({
      origen: 'dispositivo',
      tipo: 'dispositivo_sin_reportar',
      patente: v ? v.patente : null,
      referencia: a.device_uid,
      referencia_nombre: null,
      fecha_generada: a.fecha_generada,
      fecha_revisada: a.fecha_revisada,
      estado: estado(a),
      clave: { device_uid: a.device_uid, fecha_generada: a.fecha_generada },
    });
  }
  return out.sort((a, b) => a.fecha_generada.localeCompare(b.fecha_generada)); // más antiguas primero
}

// ---------- reglas de negocio ----------
// Recalcula el estado de los planes de una unidad (RN04, RN05, RN07) y genera alertas al pasar a próxima/vencida (RF12).
function recalcularPlanes(patente) {
  const u = unidadPorPatente(patente);
  for (const plan of db.planes_mantenimiento.filter((p) => p.patente === patente)) {
    const ev = evaluarPlan(plan, u.km_actual, postergacionAbierta(db, patente, plan.codigo_tarea));
    if (ev.estado === plan.estado) continue;
    plan.estado = ev.estado;
    if (ev.estado === 'proxima' || ev.estado === 'vencida') {
      db.alertas_plan.push({
        patente,
        codigo_tarea: plan.codigo_tarea,
        tipo: ev.estado === 'proxima' ? 'tarea_proxima' : 'tarea_vencida',
        fecha_generada: ahora(),
        fecha_revisada: null,
      });
    }
  }
}

function exigirCampos(body, campos) {
  const faltan = campos.filter((c) => body[c] === undefined || body[c] === null || body[c] === '');
  if (faltan.length) throw err400(`Faltan campos obligatorios: ${faltan.join(', ')}.`);
}

// ---------- rutas ----------
const routes = [];
function route(method, pattern, handler, { admin = false } = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z_]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
  routes.push({ method, re, keys, handler, admin });
}

// 1. Sesión y usuarios (M1)
route('GET', '/me', ({ user }) => ok({ email: user.email, nombre: user.nombre, rol: user.rol }));
route('GET', '/usuarios', () => ok({ data: db.usuarios }), { admin: true });
route(
  'POST',
  '/usuarios',
  ({ body }) => {
    exigirCampos(body, ['email', 'rol']);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) throw err400('Email inválido.');
    if (!enumOk('rol', body.rol)) throw err400('rol debe ser admin o mantenimiento.');
    if (db.usuarios.some((u) => u.email === body.email)) throw err409('Ya existe un usuario con ese email.');
    const nuevo = { email: body.email, nombre: body.nombre || null, rol: body.rol, created_at: ahora() };
    db.usuarios.push(nuevo);
    return creado(nuevo);
  },
  { admin: true },
);
route(
  'PATCH',
  '/usuarios/:email',
  ({ params, body }) => {
    const u = db.usuarios.find((x) => x.email === params.email);
    if (!u) throw err404('No existe el usuario.');
    if (body.rol !== undefined) {
      if (!enumOk('rol', body.rol)) throw err400('rol debe ser admin o mantenimiento.');
      u.rol = body.rol;
    }
    if (body.nombre !== undefined) u.nombre = body.nombre;
    return ok(u);
  },
  { admin: true },
);

// 2. Unidades y dispositivos (M2) + 7. Vista de flota (M9)
route('GET', '/unidades', ({ query }) => {
  const activa = query.get('activa') === 'false' ? false : true;
  let items = db.unidades.filter((u) => u.activa === activa).map(resumenUnidad);
  const tenencia = query.get('tenencia');
  if (tenencia) items = items.filter((u) => u.tenencia === tenencia);
  const estado = query.get('estado');
  if (estado) {
    items = items.filter((u) => {
      if (estado === 'con_fallas') return u.fallas_activas > 0;
      if (estado === 'sin_reportar') return u.dispositivo && u.dispositivo.estado === 'sin_reportar';
      if (estado === 'sin_dispositivo') return u.dispositivo === null;
      return u.estado_mantenimiento === estado;
    });
  }
  return ok(paginar(items, query));
});
route(
  'POST',
  '/unidades',
  ({ body }) => {
    exigirCampos(body, ['patente', 'marca', 'tenencia', 'protocolo']);
    const patente = String(body.patente).toUpperCase().trim();
    if (!/^[A-Z0-9]{6,10}$/.test(patente)) throw err400('Patente inválida.');
    if (!enumOk('tenencia', body.tenencia)) throw err400('tenencia debe ser propia o fletero.');
    if (!enumOk('protocolo', body.protocolo)) throw err400('protocolo debe ser J1939 o J1979.');
    if (body.anio !== undefined && body.anio !== null && !Number.isInteger(body.anio)) throw err400('anio debe ser un entero.');
    if (unidadPorPatente(patente)) throw err409('Ya existe una unidad con esa patente.');
    const u = {
      patente,
      marca: body.marca,
      modelo: body.modelo || null,
      anio: body.anio ?? null,
      tenencia: body.tenencia,
      titular: body.titular || null,
      protocolo: body.protocolo,
      km_actual: 0,
      km_fuente: 'manual',
      activa: true,
      created_at: ahora(),
    };
    db.unidades.push(u);
    return creado(u);
  },
  { admin: true },
);
route('GET', '/unidades/:patente', ({ params }) => ok(getUnidad(params.patente)));
route(
  'PATCH',
  '/unidades/:patente',
  ({ params, body }) => {
    const u = getUnidad(params.patente);
    if (body.tenencia !== undefined && !enumOk('tenencia', body.tenencia)) throw err400('tenencia debe ser propia o fletero.');
    if (body.protocolo !== undefined && !enumOk('protocolo', body.protocolo)) throw err400('protocolo debe ser J1939 o J1979.');
    for (const c of ['marca', 'modelo', 'anio', 'tenencia', 'titular', 'protocolo']) if (body[c] !== undefined) u[c] = body[c];
    return ok(u);
  },
  { admin: true },
);
route(
  'DELETE',
  '/unidades/:patente',
  ({ params }) => {
    const u = getUnidad(params.patente);
    if (dispositivoDeUnidad(u.patente)) throw err409('La unidad tiene un dispositivo vinculado: desvinculalo antes de darla de baja.');
    u.activa = false; // baja lógica: conserva su historial
    return ok(u);
  },
  { admin: true },
);
route(
  'GET',
  '/unidades/:patente/detalle',
  ({ params }) => {
    const u = getUnidad(params.patente);
    return ok({
      unidad: u,
      dispositivo: dispositivoDeUnidad(u.patente),
      planes: planesDe(u.patente),
      fallas_activas: db.fallas
        .filter((f) => f.patente === u.patente && !f.fecha_cierre)
        .sort((a, b) => b.fecha_aparicion.localeCompare(a.fecha_aparicion))
        .map(vistaFalla),
    });
  },
);

route('GET', '/dispositivos', () => ok({ data: db.dispositivos.map(vistaDispositivo) }), { admin: true });
route(
  'POST',
  '/dispositivos',
  ({ body }) => {
    exigirCampos(body, ['device_uid']);
    if (!/^[\w-]{3,50}$/.test(body.device_uid)) throw err400('device_uid inválido (3 a 50 caracteres: letras, números, guion).');
    if (db.dispositivos.some((d) => d.device_uid === body.device_uid)) throw err409('Ya existe un dispositivo con ese device_uid.');
    const d = { device_uid: body.device_uid, estado: 'inactivo', ultima_comunicacion: null, created_at: ahora() };
    db.dispositivos.push(d);
    return creado(vistaDispositivo(d));
  },
  { admin: true },
);
route(
  'PATCH',
  '/dispositivos/:device_uid/vincular',
  ({ params, body }) => {
    exigirCampos(body, ['patente']);
    const d = db.dispositivos.find((x) => x.device_uid === params.device_uid);
    if (!d) throw err404('No existe el dispositivo.');
    const u = getUnidad(body.patente);
    if (!u.activa) throw err400('No se puede vincular a una unidad dada de baja.');
    if (db.vinculaciones.some((v) => v.device_uid === d.device_uid && !v.hasta)) throw err409('El dispositivo ya está vinculado a una unidad (RN02).');
    if (db.vinculaciones.some((v) => v.patente === u.patente && !v.hasta)) throw err409('La unidad ya tiene un dispositivo vinculado (RN02).');
    db.vinculaciones.push({ device_uid: d.device_uid, patente: u.patente, desde: ahora(), hasta: null });
    return ok(vistaDispositivo(d));
  },
  { admin: true },
);
route(
  'PATCH',
  '/dispositivos/:device_uid/desvincular',
  ({ params }) => {
    const d = db.dispositivos.find((x) => x.device_uid === params.device_uid);
    if (!d) throw err404('No existe el dispositivo.');
    const v = db.vinculaciones.find((x) => x.device_uid === d.device_uid && !x.hasta);
    if (!v) throw err409('El dispositivo no está vinculado a ninguna unidad.');
    v.hasta = ahora();
    d.estado = 'inactivo';
    return ok(vistaDispositivo(d));
  },
  { admin: true },
);

// 3. Motor de mantenimiento (M4)
route('GET', '/tareas-catalogo', () => ok({ data: db.tareas_catalogo }));
route(
  'POST',
  '/tareas-catalogo',
  ({ body }) => {
    exigirCampos(body, ['codigo', 'nombre', 'intervalo_km_default']);
    if (!/^[A-Z0-9_]{2,20}$/.test(body.codigo)) throw err400('codigo inválido (mayúsculas, números y _; hasta 20 caracteres).');
    if (!esEntPos(body.intervalo_km_default)) throw err400('intervalo_km_default debe ser un entero positivo.');
    const umbral = body.umbral_aviso_km_default ?? 4000;
    if (!esEntPos(umbral)) throw err400('umbral_aviso_km_default debe ser un entero positivo.');
    if (db.tareas_catalogo.some((t) => t.codigo === body.codigo)) throw err409('Ya existe una tarea con ese código.');
    const t = { codigo: body.codigo, nombre: body.nombre, intervalo_km_default: body.intervalo_km_default, umbral_aviso_km_default: umbral };
    db.tareas_catalogo.push(t);
    return creado(t);
  },
  { admin: true },
);
route('GET', '/unidades/:patente/planes', ({ params }) => ok({ data: planesDe(getUnidad(params.patente).patente) }));
route(
  'POST',
  '/unidades/:patente/planes',
  ({ params, body }) => {
    const u = getUnidad(params.patente);
    exigirCampos(body, ['codigo_tarea']);
    const cat = db.tareas_catalogo.find((t) => t.codigo === body.codigo_tarea);
    if (!cat) throw err400('La tarea no existe en el catálogo.');
    if (db.planes_mantenimiento.some((p) => p.patente === u.patente && p.codigo_tarea === cat.codigo)) {
      throw err409('La unidad ya tiene asignada esa tarea.');
    }
    const intervalo = body.intervalo_km ?? cat.intervalo_km_default;
    const umbral = body.umbral_aviso_km ?? cat.umbral_aviso_km_default;
    if (!esEntPos(intervalo) || !esEntPos(umbral)) throw err400('intervalo_km y umbral_aviso_km deben ser enteros positivos.');
    // DECISIÓN ABIERTA (ver README): si no se informa km_ultimo_service, el mock asume que recién se hizo (= km actual).
    const kmUlt = body.km_ultimo_service ?? u.km_actual;
    if (!esNum(kmUlt) || kmUlt < 0 || kmUlt > u.km_actual) throw err400('km_ultimo_service debe estar entre 0 y el km actual.');
    const plan = {
      patente: u.patente,
      codigo_tarea: cat.codigo,
      intervalo_km: intervalo,
      umbral_aviso_km: umbral,
      km_ultimo_service: kmUlt,
      estado: 'al_dia',
      created_at: ahora(),
    };
    db.planes_mantenimiento.push(plan);
    recalcularPlanes(u.patente);
    return creado(vistaPlan(plan));
  },
  { admin: true },
);
route(
  'PATCH',
  '/unidades/:patente/planes/:codigo_tarea',
  ({ params, body }) => {
    const u = getUnidad(params.patente);
    const plan = db.planes_mantenimiento.find((p) => p.patente === u.patente && p.codigo_tarea === params.codigo_tarea);
    if (!plan) throw err404('La unidad no tiene ese plan.');
    for (const c of ['intervalo_km', 'umbral_aviso_km']) {
      if (body[c] === undefined) continue;
      if (!esEntPos(body[c])) throw err400(`${c} debe ser un entero positivo.`);
      plan[c] = body[c];
    }
    recalcularPlanes(u.patente);
    return ok(vistaPlan(plan));
  },
  { admin: true },
);

// 4. Services y postergaciones (M5)
route('GET', '/unidades/:patente/services', ({ params, query }) => {
  const u = getUnidad(params.patente);
  const items = filtrarPeriodo(db.services.filter((s) => s.patente === u.patente), 'fecha', query)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map(vistaService);
  return ok(paginar(items, query));
});
route('POST', '/unidades/:patente/services', ({ params, body, user }) => {
  const u = getUnidad(params.patente);
  if (!u.activa) throw err400('La unidad está dada de baja.');
  exigirCampos(body, ['km']);
  if (!esNum(body.km) || body.km < 0) throw err400('km debe ser un número mayor o igual a 0.');
  const fecha = body.fecha || hoy();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) throw err400('fecha debe tener formato YYYY-MM-DD.');
  if (fecha > hoy()) throw err400('La fecha del service no puede ser futura.');
  if (!Array.isArray(body.tareas) || body.tareas.length === 0) throw err400('Seleccioná al menos una tarea.');
  const codigos = [...new Set(body.tareas)];
  const sinPlan = codigos.filter((c) => !db.planes_mantenimiento.some((p) => p.patente === u.patente && p.codigo_tarea === c));
  if (sinPlan.length) throw err400(`Tareas que no están en el plan de la unidad: ${sinPlan.join(', ')}.`);
  if (db.services.some((s) => s.patente === u.patente && s.fecha === fecha)) throw err409('Ya hay un service registrado para esa unidad en esa fecha.');

  const service = {
    patente: u.patente,
    fecha,
    km: body.km,
    observaciones: body.observaciones || null,
    email_usuario: user.email,
    created_at: ahora(),
  };
  db.services.push(service);
  for (const c of codigos) {
    db.service_tareas.push({ patente: u.patente, fecha, codigo_tarea: c });
    const plan = db.planes_mantenimiento.find((p) => p.patente === u.patente && p.codigo_tarea === c);
    plan.km_ultimo_service = body.km; // RN06: reinicia la cuenta
    db.postergaciones.filter((p) => p.patente === u.patente && p.codigo_tarea === c && !p.cerrada).forEach((p) => (p.cerrada = true));
  }
  if (body.km > u.km_actual) {
    u.km_actual = body.km; // RN08
    u.km_fuente = 'manual';
  }
  recalcularPlanes(u.patente);
  return creado(vistaService(service));
});
route('GET', '/unidades/:patente/postergaciones', ({ params, query }) => {
  const u = getUnidad(params.patente);
  const items = filtrarPeriodo(db.postergaciones.filter((p) => p.patente === u.patente), 'fecha', query)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map(vistaPostergacion);
  return ok(paginar(items, query));
});
route('POST', '/unidades/:patente/planes/:codigo_tarea/postergaciones', ({ params, body, user }) => {
  const u = getUnidad(params.patente);
  const plan = db.planes_mantenimiento.find((p) => p.patente === u.patente && p.codigo_tarea === params.codigo_tarea);
  if (!plan) throw err404('La unidad no tiene ese plan.');
  exigirCampos(body, ['motivo', 'km_limite_nuevo']);
  if (!enumOk('motivo', body.motivo)) throw err400('motivo debe ser falta_espacio, salida_urgente u otro.');
  if (body.motivo === 'otro' && !esTexto(body.motivo_descripcion)) throw err400('Con motivo "otro" la descripción es obligatoria (RN07).');
  if (!Number.isInteger(body.km_limite_nuevo)) throw err400('km_limite_nuevo debe ser un entero.');
  if (body.km_limite_nuevo <= u.km_actual) throw err400(`El nuevo límite debe ser mayor al km actual (${u.km_actual}).`);
  const post = {
    patente: u.patente,
    codigo_tarea: plan.codigo_tarea,
    fecha: ahora(),
    motivo: body.motivo,
    motivo_descripcion: body.motivo === 'otro' ? body.motivo_descripcion.trim() : body.motivo_descripcion || null,
    km_limite_nuevo: body.km_limite_nuevo,
    email_usuario: user.email,
    cerrada: false,
  };
  db.postergaciones.push(post);
  recalcularPlanes(u.patente);
  return creado(vistaPostergacion(post));
});

// 5. Fallas (M6)
route('GET', '/unidades/:patente/fallas', ({ params, query }) => {
  const u = getUnidad(params.patente);
  const estado = query.get('estado');
  if (estado && !['activo', 'inactivo'].includes(estado)) throw err400('estado debe ser activo o inactivo.');
  const items = db.fallas
    .filter((f) => f.patente === u.patente)
    .map(vistaFalla)
    .filter((f) => !estado || f.estado === estado)
    .sort((a, b) => b.fecha_aparicion.localeCompare(a.fecha_aparicion));
  return ok({ data: items });
});

// 6. Alertas (M7)
route('GET', '/alertas', ({ query }) => {
  const estado = query.get('estado');
  if (estado && !['abierta', 'revisada'].includes(estado)) throw err400('estado debe ser abierta o revisada.');
  const tipo = query.get('tipo');
  const patente = query.get('patente');
  const items = todasLasAlertas().filter(
    (a) => (!estado || a.estado === estado) && (!tipo || a.tipo === tipo) && (!patente || a.patente === patente.toUpperCase()),
  );
  return ok(paginar(items, query));
});
route('PATCH', '/alertas/revisar', ({ body }) => {
  exigirCampos(body, ['origen']);
  let fila;
  if (body.origen === 'plan') {
    exigirCampos(body, ['patente', 'codigo_tarea', 'tipo', 'fecha_generada']);
    fila = db.alertas_plan.find((a) => a.patente === body.patente && a.codigo_tarea === body.codigo_tarea && a.tipo === body.tipo && a.fecha_generada === body.fecha_generada);
  } else if (body.origen === 'falla') {
    exigirCampos(body, ['patente', 'codigo', 'fecha_aparicion']);
    fila = db.alertas_falla.find((a) => a.patente === body.patente && a.codigo === body.codigo && a.fecha_aparicion === body.fecha_aparicion);
  } else if (body.origen === 'dispositivo') {
    exigirCampos(body, ['device_uid', 'fecha_generada']);
    fila = db.alertas_dispositivo.find((a) => a.device_uid === body.device_uid && a.fecha_generada === body.fecha_generada);
  } else {
    throw err400('origen debe ser plan, falla o dispositivo.');
  }
  if (!fila) throw err404('No existe esa alerta.');
  if (!fila.fecha_revisada) fila.fecha_revisada = ahora(); // idempotente
  const clave = JSON.stringify;
  const vista = todasLasAlertas().find((a) => a.origen === body.origen && clave(a.clave) === clave(Object.fromEntries(Object.keys(a.clave).map((k) => [k, body[k]]))));
  return ok(vista);
});

// 8. Kilometraje manual (M9)
route('POST', '/unidades/:patente/kilometraje', ({ params, body, user }) => {
  const u = getUnidad(params.patente);
  exigirCampos(body, ['km']);
  if (!esNum(body.km) || body.km < 0) throw err400('km debe ser un número mayor o igual a 0.');
  if (body.km < u.km_actual) throw err409(`El kilometraje no puede disminuir (RN09): el actual es ${u.km_actual}.`);
  let fecha = ahora();
  if (body.fecha) {
    const t = Date.parse(body.fecha);
    if (Number.isNaN(t)) throw err400('fecha inválida.');
    fecha = new Date(t).toISOString();
  }
  if (db.kilometraje_historial.some((k) => k.patente === u.patente && k.fecha === fecha)) throw err409('Ya hay una carga con esa fecha exacta.');
  const fila = { patente: u.patente, fecha, km: body.km, fuente: 'manual', email_usuario: user.email };
  db.kilometraje_historial.push(fila);
  u.km_actual = body.km;
  u.km_fuente = 'manual';
  recalcularPlanes(u.patente);
  return creado(fila);
});

// ---------- servidor HTTP ----------
function enviar(res, status, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function leerBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        const parsed = JSON.parse(data);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        resolve(parsed);
      } catch {
        reject(err400('El body no es un JSON válido (se espera un objeto).'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (req.method === 'OPTIONS') return enviar(res, 204);

  const url = new URL(req.url, 'http://localhost');
  const t0 = Date.now();
  let status = 500;
  try {
    if (DELAY) await new Promise((r) => setTimeout(r, DELAY));

    if (req.method === 'POST' && url.pathname === '/__mock/reset') {
      cargarSeed();
      status = 200;
      return enviar(res, 200, { status: 'ok', mensaje: 'Datos restaurados al estado inicial.' });
    }
    if (!url.pathname.startsWith(BASE)) throw err404(`Las rutas de la API empiezan con ${BASE}.`);

    const sub = decodeURIComponent(url.pathname.slice(BASE.length)) || '/';
    let hit = null;
    let otroMetodo = false;
    for (const r of routes) {
      const m = r.re.exec(sub);
      if (!m) continue;
      if (r.method === req.method) {
        hit = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])) };
        break;
      }
      otroMetodo = true;
    }
    if (!hit) throw otroMetodo ? new HttpError(405, 'metodo_no_permitido', `${req.method} no está soportado en esta ruta.`) : err404('Ruta inexistente.');

    const user = resolverUsuario(req);
    if (hit.r.admin && user.rol !== 'admin') throw new HttpError(403, 'sin_permiso', 'Esta operación requiere rol admin (RN11).');
    const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await leerBody(req) : {};
    const out = await hit.r.handler({ params: hit.params, query: url.searchParams, body, user });
    status = out.status;
    enviar(res, out.status, out.body);
  } catch (e) {
    if (e instanceof HttpError) {
      status = e.status;
      enviar(res, e.status, { error: { code: e.code, message: e.message } });
    } else {
      console.error(e);
      status = 500;
      enviar(res, 500, { error: { code: 'error_interno', message: 'Error interno del mock.' } });
    }
  } finally {
    console.log(`${req.method} ${url.pathname}${url.search} -> ${status} (${Date.now() - t0} ms)`);
  }
});

server.listen(PORT, () => {
  console.log(`Mock API en http://localhost:${PORT}${BASE}`);
  console.log(`  auth: ${STRICT ? 'estricta (401 sin token)' : 'laxa'} · latencia simulada: ${DELAY} ms`);
  console.log('  Authorization: Bearer admin | Bearer mantenimiento   ·   POST /__mock/reset restaura los datos');
});
