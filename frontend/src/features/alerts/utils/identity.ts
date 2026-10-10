import type { Alerta, OrigenAlerta, RevisarAlertaBody } from '../types'

/**
 * Las alertas no tienen un id: se identifican por su origen y su `clave` completa. Esta
 * identidad sirve de `key` de React y para seguir el estado de cada revisión.
 */
export const alertKey = (alerta: Alerta): string => {
  const parts = Object.keys(alerta.clave)
    .sort()
    .map((field) => `${field}=${String(alerta.clave[field])}`)
  return [alerta.origen, ...parts].join('|')
}

// Campos que el contrato exige en el cuerpo de PATCH /alertas/revisar, por origen.
const REQUIRED_KEY_FIELDS: Record<OrigenAlerta, readonly string[]> = {
  plan: ['patente', 'codigo_tarea', 'tipo', 'fecha_generada'],
  falla: ['patente', 'codigo', 'fecha_aparicion'],
  dispositivo: ['device_uid', 'fecha_generada'],
}

/**
 * Cuerpo de PATCH /alertas/revisar: `{ origen, ...clave }`, con la `clave` tal como la
 * entregó la API (el contrato pide reenviarla sin cambios). No se inventan ni reconstruyen
 * campos: si falta alguno, es un error y no se envía nada.
 */
export const buildReviewBody = (alerta: Alerta): RevisarAlertaBody => {
  const missing = REQUIRED_KEY_FIELDS[alerta.origen].filter(
    (field) => typeof alerta.clave[field] !== 'string',
  )
  if (missing.length > 0) {
    throw new Error(
      `La alerta no trae los datos necesarios para marcarla como revisada (${missing.join(', ')}).`,
    )
  }
  return { origen: alerta.origen, ...alerta.clave } as RevisarAlertaBody
}
