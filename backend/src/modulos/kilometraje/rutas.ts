import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { transaccion } from '../../db.js';
import { conflicto, validacion } from '../../http/errores.js';
import { esNumero, exigirCampos, param, type Body } from '../../http/validacion.js';
import { recalcularPlanes } from '../mantenimiento/planes.js';
import { obtenerUnidad } from '../unidades/repositorio.js';

// M9 — Carga manual de km (RF06, RN08, RN09, RNF11). Para unidades sin dispositivo:
// queda en kilometraje_historial con quién la hizo, y recalcula igual que una lectura MQTT.

export function rutasKilometraje({ sql }: Dependencias) {
  const r = Router();

  r.post('/unidades/:patente/kilometraje', async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['km']);
    if (!esNumero(b.km) || b.km < 0) throw validacion('km debe ser un número mayor o igual a 0.');
    const km = b.km;

    let fecha = new Date();
    if (b.fecha !== undefined) {
      const t = typeof b.fecha === 'string' ? Date.parse(b.fecha) : NaN;
      if (Number.isNaN(t)) throw validacion('fecha inválida (se espera ISO 8601).');
      if (t > Date.now() + 60_000) throw validacion('La fecha de la carga no puede ser futura.');
      fecha = new Date(t);
    }

    const carga = await transaccion(sql, async (tx) => {
      const u = await obtenerUnidad(tx, param(req.params.patente), { bloquear: true });
      if (!u.activa) throw validacion('La unidad está dada de baja.');
      // RN09: el km nunca disminuye.
      if (km < u.km_actual) throw conflicto(`El kilometraje no puede disminuir (RN09): el actual es ${u.km_actual}.`);

      const [fila] = await tx`
        insert into kilometraje_historial (patente, fecha, km, fuente, email_usuario)
        values (${u.patente}, ${fecha}, ${km}, 'manual', ${req.usuario!.email})
        on conflict do nothing
        returning patente, fecha, km, fuente, email_usuario`;
      if (!fila) throw conflicto('Ya hay una carga con esa fecha exacta.');

      await tx`update unidades set km_actual = ${km}, km_fuente = 'manual' where patente = ${u.patente}`;
      await recalcularPlanes(tx, u.patente);
      return fila;
    });
    res.status(201).json(carga);
  });

  return r;
}