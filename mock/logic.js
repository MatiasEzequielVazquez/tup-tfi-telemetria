'use strict';
// Reglas de negocio del motor de mantenimiento (RN04, RN05, RN07).
// Las usan tanto el generador de datos como el servidor mock, para que coincidan siempre.

// Del más crítico al menos crítico: define el "estado más crítico" de una unidad (RF14).
const ORDEN_CRITICIDAD = ['vencida', 'proxima', 'postergada', 'al_dia'];

const redondear = (n) => Math.round(n * 10) / 10;

function postergacionAbierta(db, patente, codigo) {
  return (
    db.postergaciones
      .filter((p) => p.patente === patente && p.codigo_tarea === codigo && !p.cerrada)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null
  );
}

// Devuelve el estado de un plan y el km límite que se usa para contar los km restantes.
function evaluarPlan(plan, kmActual, postergacion) {
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

module.exports = { ORDEN_CRITICIDAD, redondear, postergacionAbierta, evaluarPlan };
