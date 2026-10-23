import type postgres from 'postgres';
import { transaccion, type Sql } from '../../db.js';
import { abrirFalla, cerrarFalla } from '../fallas/repositorio.js';
import { recalcularPlanes } from '../mantenimiento/planes.js';
import type { Mensaje } from './parser.js';

// M3 — Procesamiento de un mensaje ya validado. Todo en una transacción: se aplica completo
// o nada (si falla, un reintento de MQTT con QoS 1 lo vuelve a intentar).

const FUENTE_KM = { J1939: 'odometro', J1979: 'estimado' } as const; // RN08

export interface Resultado {
  device_uid: string;
  resultado: 'procesado' | 'dispositivo_desconocido' | 'sin_vinculacion';
  patente: string | null;
  guardadas: number;
  duplicadas: number;
  inconsistentes: number;
  fallas_abiertas: number;
  fallas_cerradas: number;
  km_actualizado: boolean;
}

export async function procesarMensaje(sql: Sql, msg: Mensaje, { instante = new Date() } = {}): Promise<Resultado> {
  return transaccion(sql, async (tx) => {
    const r: Resultado = {
      device_uid: msg.device_uid, resultado: 'procesado', patente: null,
      guardadas: 0, duplicadas: 0, inconsistentes: 0, fallas_abiertas: 0, fallas_cerradas: 0, km_actualizado: false,
    };

    // 1. Dispositivo registrado y última comunicación (RN10). Solo pasa a "activo" si hoy está vinculado.
    const [disp] = await tx`select 1 from dispositivos where device_uid = ${msg.device_uid} for update`;
    if (!disp) return { ...r, resultado: 'dispositivo_desconocido' };
    const [vigenteHoy] = await tx`select 1 from vinculaciones where device_uid = ${msg.device_uid} and hasta is null`;
    await tx`
      update dispositivos
         set ultima_comunicacion = greatest(coalesce(ultima_comunicacion, ${instante}::timestamptz), ${instante}::timestamptz)
             ${vigenteHoy ? tx`, estado = 'activo'` : tx``}
       where device_uid = ${msg.device_uid}`;

    // 2. Vinculación vigente AL MOMENTO DE LA LECTURA.
    //    "desde" viaja como texto: es parte de la FK de lecturas y si pasara por un Date de JS
    //    perdería los microsegundos (la fila no coincidiría).
    const [vinc] = await tx<{ desde: string; patente: string; protocolo: 'J1939' | 'J1979' }[]>`
      select v.desde::text as desde, v.patente, u.protocolo
        from vinculaciones v join unidades u on u.patente = v.patente
       where v.device_uid = ${msg.device_uid}
         and v.desde <= ${msg.timestamp} and (v.hasta is null or ${msg.timestamp} < v.hasta)`;
    if (!vinc) return { ...r, resultado: 'sin_vinculacion' };
    r.patente = vinc.patente;
    const desde = tx`${vinc.desde}::timestamptz`;

    const [unidad] = await tx<{ km_actual: number }[]>`select km_actual from unidades where patente = ${vinc.patente} for update`;
    let kmNuevo: number | null = null;

    // 3 y 4. Mediciones, con control de consistencia (RN09).
    for (const med of msg.mediciones) {
      // Retrocede si hay una lectura ANTERIOR (del mismo dispositivo en esta vinculación) con más valor.
      const [retrocede] = await tx`
        select 1 from lecturas
         where device_uid = ${msg.device_uid} and vinculacion_desde = ${desde} and tipo = ${med.tipo}
           and consistente and marca_tiempo_dispositivo < ${msg.timestamp} and valor > ${med.valor}
         limit 1`;
      let consistente = !retrocede;

      if (consistente && med.tipo === 'km' && med.valor < unidad!.km_actual) {
        // Menor al km de la unidad: es inconsistente solo si es la lectura MÁS NUEVA. Una lectura
        // vieja que llega tarde (guardada sin señal, RNF02) tiene lecturas posteriores y es válida.
        const [posterior] = await tx`
          select 1 from lecturas
           where device_uid = ${msg.device_uid} and vinculacion_desde = ${desde} and tipo = 'km'
             and marca_tiempo_dispositivo > ${msg.timestamp}
           limit 1`;
        consistente = Boolean(posterior);
      }

      const ins = await tx`
        insert into lecturas (device_uid, marca_tiempo_dispositivo, tipo, vinculacion_desde, valor, origen, marca_tiempo_recepcion, consistente)
        values (${msg.device_uid}, ${msg.timestamp}, ${med.tipo}, ${desde}, ${med.valor},
                ${tx.json(med.origen as postgres.JSONValue)}, ${instante}, ${consistente})
        on conflict do nothing returning 1`;
      if (!ins.length) {
        r.duplicadas++; // reintento de MQTT: ya estaba guardada
        continue;
      }
      r.guardadas++;
      if (!consistente) r.inconsistentes++;
      if (med.tipo === 'km' && consistente && med.valor > unidad!.km_actual) kmNuevo = med.valor;
    }

    // 5. Km de la unidad (RN08) y recálculo de planes (M4).
    if (kmNuevo !== null) {
      await tx`update unidades set km_actual = ${kmNuevo}, km_fuente = ${FUENTE_KM[vinc.protocolo]} where patente = ${vinc.patente}`;
      r.km_actualizado = true;
    }

    // 6. Fallas (RN12).
    for (const dtc of msg.dtcs) {
      if (dtc.activo) {
        if (await abrirFalla(tx, { patente: vinc.patente, codigo: dtc.codigo, fechaAparicion: msg.timestamp, instante })) r.fallas_abiertas++;
      } else if (await cerrarFalla(tx, { patente: vinc.patente, codigo: dtc.codigo, fechaCierre: msg.timestamp })) {
        r.fallas_cerradas++;
      }
    }

    if (r.km_actualizado) await recalcularPlanes(tx, vinc.patente, instante);
    return r;
  });
}