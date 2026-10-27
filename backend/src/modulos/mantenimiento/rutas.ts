import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { soloAdmin } from '../../auth/middleware.js';
import { transaccion } from '../../db.js';
import { conflicto, noEncontrado, validacion } from '../../http/errores.js';
import { esEnteroPositivo, esNumero, exigirCampos, param, query, textoObligatorio, type Body } from '../../http/validacion.js';
import { obtenerUnidad } from '../unidades/repositorio.js';
import { listarPlanes, obtenerPlan, recalcularPlanes } from './planes.js';

// M4 — Catálogo de tareas y planes por unidad (RF07, RF08, RN03).

interface TareaCatalogo {
  codigo: string;
  nombre: string;
  intervalo_km_default: number;
  umbral_aviso_km_default: number;
  activa: boolean;
}

const REGEX_CODIGO_TAREA = /^[A-Z0-9_]{2,20}$/;

export function rutasMantenimiento({ sql }: Dependencias) {
  const r = Router();

  // Sin filtro devuelve todas (las inactivas, para poder reactivarlas). ?activa=true para asignar a unidades.
  r.get('/tareas-catalogo', async (req, res) => {
    const activa = query(req.query.activa);
    if (activa && !['true', 'false'].includes(activa)) throw validacion('activa debe ser true o false.');
    const data = await sql<TareaCatalogo[]>`
      select codigo, nombre, intervalo_km_default, umbral_aviso_km_default, activa
        from tareas_catalogo
       where ${activa ? sql`activa = ${activa === 'true'}` : sql`true`}
       order by activa desc, intervalo_km_default, codigo`;
    res.json({ data });
  });

  r.post('/tareas-catalogo', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['codigo', 'nombre', 'intervalo_km_default']);
    if (typeof b.codigo !== 'string' || !REGEX_CODIGO_TAREA.test(b.codigo)) {
      throw validacion('codigo inválido (mayúsculas, números y _; hasta 20 caracteres).');
    }
    if (!esEnteroPositivo(b.intervalo_km_default)) throw validacion('intervalo_km_default debe ser un entero positivo.');
    const umbral = b.umbral_aviso_km_default ?? 4000; // RN05: 4.000 km por defecto
    if (!esEnteroPositivo(umbral)) throw validacion('umbral_aviso_km_default debe ser un entero positivo.');

    const [t] = await sql<TareaCatalogo[]>`
      insert into tareas_catalogo (codigo, nombre, intervalo_km_default, umbral_aviso_km_default)
      values (${b.codigo}, ${textoObligatorio('nombre', b.nombre, 100)}, ${b.intervalo_km_default}, ${umbral})
      on conflict (codigo) do nothing
      returning *`;
    if (!t) throw conflicto('Ya existe una tarea con ese código.');
    res.status(201).json(t);
  });

  // Editar o dar de baja una tarea del catálogo (RF07). Los valores por defecto solo se usan al
  // asignar la tarea a una unidad: los planes existentes no cambian. Baja lógica: la tarea
  // inactiva no se puede asignar, pero sus planes, services y alertas se conservan (RNF11).
  r.patch('/tareas-catalogo/:codigo', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    const cambios: Record<string, string | number | boolean> = {};
    if (b.nombre !== undefined) cambios.nombre = textoObligatorio('nombre', b.nombre, 100);
    for (const c of ['intervalo_km_default', 'umbral_aviso_km_default'] as const) {
      if (b[c] === undefined) continue;
      if (!esEnteroPositivo(b[c])) throw validacion(`${c} debe ser un entero positivo.`);
      cambios[c] = b[c];
    }
    if (b.activa !== undefined) {
      if (typeof b.activa !== 'boolean') throw validacion('activa debe ser true o false.');
      cambios.activa = b.activa;
    }
    if (!Object.keys(cambios).length) {
      throw validacion('Indicá al menos un campo: nombre, intervalo_km_default, umbral_aviso_km_default o activa.');
    }

    const [t] = await sql<TareaCatalogo[]>`
      update tareas_catalogo set ${sql(cambios)} where codigo = ${param(req.params.codigo)}
      returning codigo, nombre, intervalo_km_default, umbral_aviso_km_default, activa`;
    if (!t) throw noEncontrado('No existe la tarea en el catálogo.');
    res.json(t);
  });

  r.get('/unidades/:patente/planes', async (req, res) => {
    const u = await obtenerUnidad(sql, param(req.params.patente));
    res.json({ data: await listarPlanes(sql, u.patente) });
  });

  // Asignar una tarea del catálogo a la unidad (RN03: intervalo y umbral se copian del
  // catálogo si no vienen). Si no se informa km_ultimo_service se toma el km actual: con
  // el default de la base (0), una unidad de 400.000 km nacería con todo vencido.
  r.post('/unidades/:patente/planes', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['codigo_tarea']);

    const plan = await transaccion(sql, async (tx) => {
      const u = await obtenerUnidad(tx, param(req.params.patente), { bloquear: true });
      if (!u.activa) throw validacion('La unidad está dada de baja.');
      const [cat] = await tx<TareaCatalogo[]>`select * from tareas_catalogo where codigo = ${String(b.codigo_tarea)}`;
      if (!cat) throw validacion('La tarea no existe en el catálogo.');
      if (!cat.activa) throw validacion('La tarea está dada de baja en el catálogo.');

      const intervalo = b.intervalo_km ?? cat.intervalo_km_default;
      const umbral = b.umbral_aviso_km ?? cat.umbral_aviso_km_default;
      if (!esEnteroPositivo(intervalo) || !esEnteroPositivo(umbral)) {
        throw validacion('intervalo_km y umbral_aviso_km deben ser enteros positivos.');
      }
      const kmUlt = b.km_ultimo_service ?? u.km_actual;
      if (!esNumero(kmUlt) || kmUlt < 0 || kmUlt > u.km_actual) {
        throw validacion(`km_ultimo_service debe estar entre 0 y el km actual (${u.km_actual}).`);
      }

      const [creado] = await tx`
        insert into planes_mantenimiento (patente, codigo_tarea, intervalo_km, umbral_aviso_km, km_ultimo_service, created_at)
        values (${u.patente}, ${cat.codigo}, ${intervalo}, ${umbral}, ${kmUlt}, ${new Date()})
        on conflict do nothing returning 1`;
      if (!creado) throw conflicto('La unidad ya tiene asignada esa tarea.');

      await recalcularPlanes(tx, u.patente); // el plan nace al_dia; puede quedar próxima o vencida
      return obtenerPlan(tx, u.patente, cat.codigo);
    });
    res.status(201).json(plan);
  });

  // Editar intervalo o umbral de un plan: cambia cuándo vence, así que recalcula.
  r.patch('/unidades/:patente/planes/:codigo_tarea', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    const codigo = param(req.params.codigo_tarea);
    const cambios: Record<string, number> = {};
    for (const c of ['intervalo_km', 'umbral_aviso_km'] as const) {
      if (b[c] === undefined) continue;
      if (!esEnteroPositivo(b[c])) throw validacion(`${c} debe ser un entero positivo.`);
      cambios[c] = b[c];
    }

    const plan = await transaccion(sql, async (tx) => {
      const u = await obtenerUnidad(tx, param(req.params.patente), { bloquear: true });
      const [existe] = await tx`select 1 from planes_mantenimiento where patente = ${u.patente} and codigo_tarea = ${codigo}`;
      if (!existe) throw noEncontrado('La unidad no tiene ese plan.');
      if (Object.keys(cambios).length) {
        await tx`update planes_mantenimiento set ${tx(cambios)} where patente = ${u.patente} and codigo_tarea = ${codigo}`;
        await recalcularPlanes(tx, u.patente);
      }
      return obtenerPlan(tx, u.patente, codigo);
    });
    res.json(plan);
  });

  return r;
}