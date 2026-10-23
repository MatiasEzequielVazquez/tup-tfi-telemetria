// Reglas del motor de mantenimiento (M4): RN04, RN05, RN07.
import type { EstadoPlan } from '../unidades/repositorio.js';

/** Del más crítico al menos crítico: define el "estado más crítico" de una unidad (RF14). */
export const ORDEN_CRITICIDAD: EstadoPlan[] = ['vencida', 'proxima', 'postergada', 'al_dia'];

export const redondear = (n: number) => Math.round(n * 10) / 10;

export interface ParametrosPlan {
  km_ultimo_service: number;
  intervalo_km: number;
  umbral_aviso_km: number;
}

/**
 * Estado de un plan y km en el que vence.
 * @param postergacion la postergación abierta más reciente, o null
 */
export function evaluarPlan(
  plan: ParametrosPlan,
  kmActual: number,
  postergacion: { km_limite_nuevo: number } | null,
): { estado: EstadoPlan; km_limite: number } {
  const proximo = redondear(plan.km_ultimo_service + plan.intervalo_km);

  if (postergacion) {
    // RN07: una tarea postergada vuelve a estar vencida si se supera el nuevo límite.
    const limite = postergacion.km_limite_nuevo;
    return { estado: kmActual > limite ? 'vencida' : 'postergada', km_limite: limite };
  }
  // RN04: vencida cuando el km actual alcanza o supera último service + intervalo.
  if (kmActual >= proximo) return { estado: 'vencida', km_limite: proximo };
  // RN05: próxima cuando faltan menos km que el umbral de aviso.
  if (proximo - kmActual < plan.umbral_aviso_km) return { estado: 'proxima', km_limite: proximo };
  return { estado: 'al_dia', km_limite: proximo };
}

/** Tipo de alerta al PASAR a un estado (RF12), o null si ese estado no alerta. */
export function alertaPorEstado(estado: EstadoPlan): 'tarea_vencida' | 'tarea_proxima' | null {
  if (estado === 'vencida') return 'tarea_vencida';
  if (estado === 'proxima') return 'tarea_proxima';
  return null;
}