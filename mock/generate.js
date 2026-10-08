'use strict';
// Genera data/db.json: datos de ejemplo con la MISMA forma que las tablas de db/schema.sql.
// Es determinístico (misma semilla -> mismo resultado). Uso: node generate.js
//
// Fecha de referencia fija: 2026-10-07T15:00:00Z. Todo lo "reciente" se calcula contra ella.

const fs = require('node:fs');
const path = require('node:path');
const { evaluarPlan } = require('./logic');

// ---------- utilidades ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261007);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const REF = new Date('2026-10-07T15:00:00Z');
const MIN = 60e3;
const H = 60 * MIN;
const D = 24 * H;
const iso = (d) => d.toISOString().replace('.000Z', 'Z');
const ago = (ms) => iso(new Date(REF.getTime() - ms));
const plus = (isoStr, ms) => iso(new Date(new Date(isoStr).getTime() + ms));
const soloFecha = (isoStr) => isoStr.slice(0, 10);
const restarDia = (fecha) => soloFecha(iso(new Date(new Date(fecha + 'T12:00:00Z').getTime() - D)));

// ---------- usuarios ----------
const usuarios = [
  { email: 'laura.gomez@flota.example', nombre: 'Laura Gómez', rol: 'admin', created_at: ago(320 * D) },
  { email: 'carlos.ibarra@flota.example', nombre: 'Carlos Ibarra', rol: 'mantenimiento', created_at: ago(300 * D) },
  { email: 'marcela.sosa@flota.example', nombre: 'Marcela Sosa', rol: 'mantenimiento', created_at: ago(210 * D) },
  { email: 'pablo.rinaldi@flota.example', nombre: 'Pablo Rinaldi', rol: 'admin', created_at: ago(90 * D) },
];
const emailsServicio = usuarios.map((u) => u.email);

// ---------- catálogo de tareas (igual al INSERT de schema.sql) ----------
const tareas_catalogo = [
  { codigo: 'ACEITE_MOTOR', nombre: 'Cambio de aceite de motor', intervalo_km_default: 40000, umbral_aviso_km_default: 4000 },
  { codigo: 'SECADOR_AIRE', nombre: 'Filtro secador de aire de frenos', intervalo_km_default: 100000, umbral_aviso_km_default: 4000 },
  { codigo: 'ACEITE_CAJA', nombre: 'Aceite de caja y diferencial', intervalo_km_default: 150000, umbral_aviso_km_default: 4000 },
];

// ---------- unidades (22: 9 propias + 13 de fleteros, como en el caso de estudio) ----------
const MARCAS = [
  ['Scania', ['R 450', 'G 410', 'R 500', 'P 360'], 'J1939'],
  ['Mercedes-Benz', ['Actros 2041', 'Actros 2646', 'Atego 1726'], 'J1939'],
  ['Volvo', ['FH 460', 'FM 380', 'VM 270'], 'J1939'],
  ['Iveco', ['Stralis 440', 'Tector 170E22'], 'J1979'],
  ['Volkswagen', ['Constellation 24.280', 'Delivery 11.180'], 'J1979'],
  ['Ford', ['Cargo 1722'], 'J1979'],
];
const PESOS_MARCA = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5];
const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const TITULARES = [
  'Hugo Benítez', 'Raúl Domínguez', 'Oscar Villalba', 'Néstor Quiroga', 'Jorge Almada', 'Ramón Cabrera', 'Eduardo Peralta',
  'Alberto Luna', 'Rubén Sandoval', 'Mario Ledesma', 'Ángel Rojas', 'Héctor Medina', 'Walter Acosta',
];

const N = 22;
const IDX_BAJA = 20; // unidad dada de baja (activa = false)
const IDX_NUEVA = 21; // unidad recién cargada, todavía sin plan de mantenimiento
const IDX_SIN_DISPOSITIVO = [4, 11, 17]; // km cargado a mano
const IDX_SIN_REPORTAR = [6, 14]; // dispositivo instalado que dejó de reportar
const IDX_CAMBIO_DISPOSITIVO = 2; // unidad que cambió de dispositivo (historial de vinculaciones)
const IDX_SINTETICO = [3, 12]; // aceite de motor cada 60.000 km (RN03)
const IDX_DOS_PLANES = 9; // sin ACEITE_CAJA

const tenencias = [...Array(9).fill('propia'), ...Array(13).fill('fletero')];
for (let i = tenencias.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [tenencias[i], tenencias[j]] = [tenencias[j], tenencias[i]];
}

const patentesUsadas = new Set();
const nuevaPatente = () => {
  for (;;) {
    const p =
      pick([...LETRAS]) + pick([...LETRAS]) + String(int(100, 999)) + pick([...LETRAS]) + pick([...LETRAS]);
    if (!patentesUsadas.has(p)) {
      patentesUsadas.add(p);
      return p;
    }
  }
};

let titularIdx = 0;
const unidades = [];
const kmPorDia = []; // km/día de cada unidad, para fechar los services
for (let i = 0; i < N; i++) {
  const [marca, modelos, protocolo] = MARCAS[pick(PESOS_MARCA)];
  const nueva = i === IDX_NUEVA;
  const anio = nueva ? 2025 : protocolo === 'J1939' ? int(2013, 2024) : int(2008, 2017);
  const kmDia = int(450, 600);
  kmPorDia.push(kmDia);
  let km = nueva ? int(8000, 25000) : Math.round((2026 - anio) * int(45000, 75000) + int(0, 15000));
  km = Math.max(20000, Math.min(950000, km));
  if (nueva) km = int(8000, 25000);
  const tenencia = tenencias[i];
  const tieneDisp = !IDX_SIN_DISPOSITIVO.includes(i) && i !== IDX_BAJA;
  unidades.push({
    patente: nuevaPatente(),
    marca,
    modelo: pick(modelos),
    anio,
    tenencia,
    titular: tenencia === 'fletero' ? TITULARES[titularIdx++] : null,
    protocolo,
    km_actual: km,
    km_fuente: tieneDisp ? (protocolo === 'J1939' ? 'odometro' : 'estimado') : 'manual',
    activa: i !== IDX_BAJA,
    created_at: ago(int(200, 420) * D),
  });
}

// ---------- dispositivos y vinculaciones ----------
const hex = () => Array.from({ length: 6 }, () => '0123456789ABCDEF'[int(0, 15)]).join('');
const dispositivos = [];
const vinculaciones = [];
const nuevoUid = () => `esp32-${hex()}`;

unidades.forEach((u, i) => {
  if (IDX_SIN_DISPOSITIVO.includes(i) || i === IDX_BAJA) return;
  let desde = ago(int(60, 400) * D);
  if (i === IDX_CAMBIO_DISPOSITIVO) {
    const viejo = nuevoUid();
    dispositivos.push({
      device_uid: viejo,
      estado: 'inactivo',
      ultima_comunicacion: ago(120 * D),
      created_at: ago(500 * D),
    });
    vinculaciones.push({ device_uid: viejo, patente: u.patente, desde: ago(500 * D), hasta: ago(120 * D) });
    desde = ago(120 * D);
  }
  const uid = nuevoUid();
  let estado = 'activo';
  let ultima = ago(int(1, 90) * MIN);
  if (IDX_SIN_REPORTAR.includes(i)) {
    estado = 'sin_reportar';
    ultima = i === IDX_SIN_REPORTAR[0] ? ago(30 * H) : ago(5 * D + 3 * H);
  }
  dispositivos.push({ device_uid: uid, estado, ultima_comunicacion: ultima, created_at: plus(desde, -D) });
  vinculaciones.push({ device_uid: uid, patente: u.patente, desde, hasta: null });
});
// Dispositivos en depósito, sin vincular.
dispositivos.push({ device_uid: nuevoUid(), estado: 'inactivo', ultima_comunicacion: null, created_at: ago(20 * D) });
dispositivos.push({ device_uid: nuevoUid(), estado: 'inactivo', ultima_comunicacion: null, created_at: ago(10 * D) });
dispositivos.sort((a, b) => a.device_uid.localeCompare(b.device_uid));

// ---------- planes, postergaciones, services ----------
const planes_mantenimiento = [];
const postergaciones = [];
const services = [];
const service_tareas = [];

const MOTIVOS = ['falta_espacio', 'salida_urgente', 'otro'];
const DESC_OTRO = ['Esperando repuesto del proveedor', 'El cliente necesita la unidad hasta el viernes', 'Sin mecánico disponible esta semana'];
const OBSERVACIONES = [
  null,
  null,
  'Se cambió también el filtro de aire.',
  'Pérdida leve en tapa de válvulas, controlar en el próximo service.',
  'Service completo sin novedades.',
  'Se rotaron neumáticos del eje trasero.',
];

unidades.forEach((u, i) => {
  if (i === IDX_NUEVA) return; // sin plan: sirve para probar el estado vacío
  const tareas = i === IDX_DOS_PLANES ? tareas_catalogo.slice(0, 2) : tareas_catalogo;
  const planesUnidad = [];

  for (const t of tareas) {
    const intervalo = t.codigo === 'ACEITE_MOTOR' && IDX_SINTETICO.includes(i) ? 60000 : t.intervalo_km_default;
    const umbral = t.umbral_aviso_km_default;
    const r = rnd();
    const esc = i === IDX_BAJA ? 'al_dia' : r < 0.1 ? 'vencida' : r < 0.28 ? 'proxima' : r < 0.38 ? 'postergada' : 'al_dia';
    let restantes;
    if (esc === 'al_dia') restantes = int(umbral + 800, Math.floor(intervalo * 0.9));
    else if (esc === 'proxima') restantes = int(500, umbral - 300);
    else restantes = -int(200, 6000);
    const kmUlt = Math.max(0, Math.round(u.km_actual + restantes - intervalo));
    const plan = {
      patente: u.patente,
      codigo_tarea: t.codigo,
      intervalo_km: intervalo,
      umbral_aviso_km: umbral,
      km_ultimo_service: kmUlt,
      estado: 'al_dia',
      created_at: ago(int(200, 400) * D),
    };
    const base = evaluarPlan(plan, u.km_actual, null);
    if (esc === 'postergada' && base.estado === 'vencida') {
      const motivo = pick(MOTIVOS);
      postergaciones.push({
        patente: u.patente,
        codigo_tarea: t.codigo,
        fecha: ago(int(1, 10) * D + int(0, 8) * H),
        motivo,
        motivo_descripcion: motivo === 'otro' ? pick(DESC_OTRO) : null,
        km_limite_nuevo: Math.round((u.km_actual + int(1500, 4000)) / 100) * 100,
        email_usuario: pick(emailsServicio),
        cerrada: false,
      });
    }
    planes_mantenimiento.push(plan);
    planesUnidad.push(plan);
  }

  // Un service suele cubrir varias tareas a la vez: algunas tareas al día comparten el km del aceite de motor.
  const aceite = planesUnidad.find((p) => p.codigo_tarea === 'ACEITE_MOTOR');
  if (aceite && aceite.km_ultimo_service > 0) {
    for (const p of planesUnidad) {
      if (p === aceite || rnd() > 0.6) continue;
      const conPostergacion = postergaciones.some((x) => x.patente === p.patente && x.codigo_tarea === p.codigo_tarea && !x.cerrada);
      const prueba = { ...p, km_ultimo_service: aceite.km_ultimo_service };
      if (!conPostergacion && evaluarPlan(p, u.km_actual, null).estado === 'al_dia' && evaluarPlan(prueba, u.km_actual, null).estado === 'al_dia') {
        p.km_ultimo_service = aceite.km_ultimo_service;
      }
    }
  }

  // Services históricos: el último de cada tarea (km_ultimo_service) + el ciclo anterior del aceite de motor.
  const porKm = new Map(); // km -> [codigos]
  const agregar = (km, codigo) => porKm.set(km, [...(porKm.get(km) || []), codigo]);
  for (const p of planesUnidad) {
    if (p.km_ultimo_service > 0) agregar(p.km_ultimo_service, p.codigo_tarea);
    if (p.codigo_tarea === 'ACEITE_MOTOR' && p.km_ultimo_service - p.intervalo_km >= 15000) {
      agregar(p.km_ultimo_service - p.intervalo_km, 'ACEITE_MOTOR');
    }
  }
  const fechasUsadas = new Set();
  const fechaPorKm = new Map();
  [...porKm.keys()]
    .sort((a, b) => b - a)
    .forEach((km) => {
      const dias = Math.round((u.km_actual - km) / kmPorDia[i]);
      let fecha = soloFecha(ago(dias * D));
      while (fechasUsadas.has(fecha)) fecha = restarDia(fecha);
      fechasUsadas.add(fecha);
      fechaPorKm.set(km, fecha);
      services.push({
        patente: u.patente,
        fecha,
        km,
        observaciones: pick(OBSERVACIONES),
        email_usuario: pick(emailsServicio),
        created_at: `${fecha}T${String(int(9, 17)).padStart(2, '0')}:00:00Z`,
      });
      for (const codigo of porKm.get(km)) service_tareas.push({ patente: u.patente, fecha, codigo_tarea: codigo });
    });

  // Algunas postergaciones históricas, ya cerradas por el service siguiente (RN06).
  for (const p of planesUnidad) {
    if (p.km_ultimo_service > 0 && rnd() < 0.25) {
      const fechaSvc = fechaPorKm.get(p.km_ultimo_service);
      const motivo = pick(MOTIVOS);
      postergaciones.push({
        patente: u.patente,
        codigo_tarea: p.codigo_tarea,
        fecha: `${restarDia(restarDia(restarDia(fechaSvc)))}T14:00:00Z`,
        motivo,
        motivo_descripcion: motivo === 'otro' ? pick(DESC_OTRO) : null,
        km_limite_nuevo: p.km_ultimo_service + int(300, 1500),
        email_usuario: pick(emailsServicio),
        cerrada: true,
      });
    }
  }
});

// El estado almacenado de cada plan se deriva de las reglas, igual que haría el backend.
for (const plan of planes_mantenimiento) {
  const u = unidades.find((x) => x.patente === plan.patente);
  const abierta = postergaciones
    .filter((p) => p.patente === plan.patente && p.codigo_tarea === plan.codigo_tarea && !p.cerrada)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  plan.estado = evaluarPlan(plan, u.km_actual, abierta || null).estado;
}

// ---------- fallas (DTC) ----------
const CODIGOS_J1939 = ['SPN-100-FMI-3', 'SPN-110-FMI-0', 'SPN-157-FMI-1', 'SPN-190-FMI-2', 'SPN-3216-FMI-4'];
const CODIGOS_J1979 = ['P0301', 'P0420', 'P0171', 'P0128'];
const fallas = [];
const alertas_falla = [];
const nuevaFalla = (u, codigo, aparicionAgo, cierreDespuesMs) => {
  const fecha_aparicion = ago(aparicionAgo);
  const fecha_cierre = cierreDespuesMs == null ? null : plus(fecha_aparicion, cierreDespuesMs);
  fallas.push({ patente: u.patente, codigo, fecha_aparicion, fecha_cierre });
  const generada = plus(fecha_aparicion, 2000);
  const reciente = fecha_cierre == null && aparicionAgo < 4 * D;
  alertas_falla.push({
    patente: u.patente,
    codigo,
    fecha_aparicion,
    fecha_generada: generada,
    fecha_revisada: reciente ? null : plus(generada, int(1, 20) * H),
  });
};
const codigosDe = (u) => (u.protocolo === 'J1939' ? CODIGOS_J1939 : CODIGOS_J1979);

// Fallas activas
[1, 5, 8, 13, 16].forEach((i, n) => {
  const u = unidades[i];
  nuevaFalla(u, pick(codigosDe(u)), (n < 3 ? int(1, 3) : int(6, 20)) * D + int(0, 10) * H, null);
});
// Una unidad con dos fallas activas
{
  const u = unidades[8];
  const otro = codigosDe(u).find((c) => !fallas.some((f) => f.patente === u.patente && f.codigo === c));
  nuevaFalla(u, otro, 2 * D + 5 * H, null);
}
// Código que apareció, se cerró y volvió a aparecer (RN12: cada aparición es una fila)
{
  const u = unidades[1];
  const cod = fallas.find((f) => f.patente === u.patente).codigo;
  nuevaFalla(u, cod, 70 * D, 3 * D);
}
// Fallas ya cerradas
[3, 10, 19, 0].forEach((i) => {
  const u = unidades[i];
  nuevaFalla(u, pick(codigosDe(u)), int(25, 120) * D, int(1, 9) * D);
});
fallas.sort((a, b) => a.patente.localeCompare(b.patente) || a.fecha_aparicion.localeCompare(b.fecha_aparicion));
alertas_falla.sort((a, b) => a.patente.localeCompare(b.patente) || a.fecha_aparicion.localeCompare(b.fecha_aparicion));

// ---------- alertas de plan ----------
const alertas_plan = [];
for (const plan of planes_mantenimiento) {
  const u = unidades.find((x) => x.patente === plan.patente);
  if (!u.activa) continue;
  if (plan.estado === 'proxima') {
    alertas_plan.push({
      patente: plan.patente,
      codigo_tarea: plan.codigo_tarea,
      tipo: 'tarea_proxima',
      fecha_generada: ago(int(1, 10) * D + int(0, 12) * H),
      fecha_revisada: null,
    });
  } else if (plan.estado === 'vencida') {
    const dVenc = int(1, 6);
    const generada = ago(dVenc * D + int(0, 12) * H);
    alertas_plan.push({ patente: plan.patente, codigo_tarea: plan.codigo_tarea, tipo: 'tarea_vencida', fecha_generada: generada, fecha_revisada: null });
    const prox = ago((dVenc + int(5, 12)) * D);
    alertas_plan.push({ patente: plan.patente, codigo_tarea: plan.codigo_tarea, tipo: 'tarea_proxima', fecha_generada: prox, fecha_revisada: plus(prox, 2 * H) });
  } else if (plan.estado === 'postergada') {
    const post = postergaciones.find((p) => p.patente === plan.patente && p.codigo_tarea === plan.codigo_tarea && !p.cerrada);
    const generada = plus(post.fecha, -D);
    alertas_plan.push({ patente: plan.patente, codigo_tarea: plan.codigo_tarea, tipo: 'tarea_vencida', fecha_generada: generada, fecha_revisada: post.fecha });
  }
}
alertas_plan.sort((a, b) => a.fecha_generada.localeCompare(b.fecha_generada));

// ---------- alertas de dispositivo ----------
const alertas_dispositivo = [];
for (const i of IDX_SIN_REPORTAR) {
  const vinc = vinculaciones.find((v) => v.patente === unidades[i].patente && !v.hasta);
  const disp = dispositivos.find((d) => d.device_uid === vinc.device_uid);
  alertas_dispositivo.push({ device_uid: disp.device_uid, fecha_generada: plus(disp.ultima_comunicacion, 24 * H), fecha_revisada: null });
}
{
  // Corte pasado, ya revisado
  const vinc = vinculaciones.find((v) => v.patente === unidades[IDX_DOS_PLANES].patente && !v.hasta);
  alertas_dispositivo.push({ device_uid: vinc.device_uid, fecha_generada: ago(40 * D), fecha_revisada: ago(39 * D) });
}

// ---------- kilometraje_historial (cargas manuales) ----------
const kilometraje_historial = [];
[...IDX_SIN_DISPOSITIVO, IDX_BAJA].forEach((i) => {
  const u = unidades[i];
  const base = i === IDX_BAJA ? 90 : 3;
  let km = u.km_actual;
  for (let k = 0; k < 4; k++) {
    kilometraje_historial.push({
      patente: u.patente,
      fecha: ago((base + 8 * k) * D + int(0, 6) * H),
      km,
      fuente: 'manual',
      email_usuario: pick(emailsServicio),
    });
    km -= int(3500, 4200);
  }
});
kilometraje_historial.sort((a, b) => a.patente.localeCompare(b.patente) || a.fecha.localeCompare(b.fecha));

services.sort((a, b) => a.patente.localeCompare(b.patente) || a.fecha.localeCompare(b.fecha));
service_tareas.sort((a, b) => a.patente.localeCompare(b.patente) || a.fecha.localeCompare(b.fecha) || a.codigo_tarea.localeCompare(b.codigo_tarea));
postergaciones.sort((a, b) => a.patente.localeCompare(b.patente) || a.fecha.localeCompare(b.fecha));
planes_mantenimiento.sort((a, b) => a.patente.localeCompare(b.patente) || a.codigo_tarea.localeCompare(b.codigo_tarea));
unidades.sort((a, b) => a.patente.localeCompare(b.patente));

// ---------- chequeos de integridad ----------
const assert = (c, m) => {
  if (!c) throw new Error('Integridad: ' + m);
};
const pat = new Set(unidades.map((u) => u.patente));
const plan = new Set(planes_mantenimiento.map((p) => `${p.patente}|${p.codigo_tarea}`));
const svc = new Set(services.map((s) => `${s.patente}|${s.fecha}`));
const dev = new Set(dispositivos.map((d) => d.device_uid));
service_tareas.forEach((s) => {
  assert(svc.has(`${s.patente}|${s.fecha}`), 'service_tareas sin service');
  assert(plan.has(`${s.patente}|${s.codigo_tarea}`), 'service_tareas con tarea no planificada');
});
postergaciones.forEach((p) => assert(plan.has(`${p.patente}|${p.codigo_tarea}`), 'postergación sin plan'));
alertas_plan.forEach((a) => assert(plan.has(`${a.patente}|${a.codigo_tarea}`), 'alerta_plan sin plan'));
alertas_dispositivo.forEach((a) => assert(dev.has(a.device_uid), 'alerta_dispositivo sin dispositivo'));
vinculaciones.forEach((v) => assert(pat.has(v.patente) && dev.has(v.device_uid), 'vinculación inválida'));
fallas.forEach((f) => assert(pat.has(f.patente), 'falla sin unidad'));
assert(new Set(services.map((s) => `${s.patente}|${s.fecha}`)).size === services.length, 'services duplicados');

const db = {
  usuarios,
  unidades,
  dispositivos,
  vinculaciones,
  tareas_catalogo,
  planes_mantenimiento,
  services,
  service_tareas,
  postergaciones,
  fallas,
  alertas_plan,
  alertas_falla,
  alertas_dispositivo,
  kilometraje_historial,
};
const destino = path.join(__dirname, 'data', 'db.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(db, null, 2) + '\n');

const cuenta = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
console.log('Escrito', destino);
console.log('planes por estado:', cuenta(planes_mantenimiento, (p) => p.estado));
console.log('alertas abiertas:', {
  plan: alertas_plan.filter((a) => !a.fecha_revisada).length,
  falla: alertas_falla.filter((a) => !a.fecha_revisada).length,
  dispositivo: alertas_dispositivo.filter((a) => !a.fecha_revisada).length,
});
console.log('filas:', Object.fromEntries(Object.entries(db).map(([k, v]) => [k, v.length])));
