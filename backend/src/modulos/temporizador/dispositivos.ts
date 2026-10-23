import type { Config } from '../../config.js';
import { transaccion, type Sql } from '../../db.js';

// M8 — Temporizador de dispositivos sin reportar (CU14, RN10).

/**
 * Una pasada: marca "sin_reportar" a los dispositivos activos y vinculados cuya última
 * comunicación supera el plazo, y genera una alerta por cada uno.
 * Como solo toma los "activo", la pasada siguiente no los repite: una alerta por episodio.
 */
export async function revisarDispositivos(sql: Sql, plazoHoras: number, instante = new Date()): Promise<string[]> {
  return transaccion(sql, async (tx) => {
    const vencidos = await tx<{ device_uid: string }[]>`
      update dispositivos d set estado = 'sin_reportar'
       where d.estado = 'activo'
         and d.ultima_comunicacion < ${instante}::timestamptz - make_interval(hours => ${plazoHoras})
         and exists (select 1 from vinculaciones v where v.device_uid = d.device_uid and v.hasta is null)
      returning d.device_uid`;

    if (vencidos.length) {
      await tx`
        insert into alertas_dispositivo ${tx(vencidos.map((v) => ({ device_uid: v.device_uid, fecha_generada: instante })))}
        on conflict do nothing`;
    }
    return vencidos.map((v) => v.device_uid);
  });
}

export function iniciarTemporizador({ sql, config }: { sql: Sql; config: Config }) {
  const { plazoSinReportarHoras, temporizadorMinutos } = config.reglas;
  let corriendo = false;

  const pasada = async () => {
    if (corriendo) return; // si una pasada tarda más que el intervalo, no se superponen
    corriendo = true;
    try {
      const marcados = await revisarDispositivos(sql, plazoSinReportarHoras);
      if (marcados.length) console.warn(`[temporizador] sin reportar hace más de ${plazoSinReportarHoras} h: ${marcados.join(', ')}`);
    } catch (e) {
      console.error('[temporizador] error:', (e as Error).message);
    } finally {
      corriendo = false;
    }
  };

  const id = setInterval(pasada, temporizadorMinutos * 60_000);
  void pasada(); // una pasada al arrancar
  console.info(`[temporizador] cada ${temporizadorMinutos} min, plazo ${plazoSinReportarHoras} h (RN10)`);
  return { detener: () => clearInterval(id) };
}