import type { Protocolo, Rol, Tenencia } from '../../../api/types'

// Un Record sobre la unión obliga a cubrir todos los valores del contrato. El orden es el de
// los selectores.
export const TENENCIA_LABEL: Record<Tenencia, string> = {
  propia: 'Propia',
  fletero: 'Fletero',
}

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  mantenimiento: 'Mantenimiento',
}

export const PROTOCOLO_LABEL: Record<Protocolo, string> = {
  J1939: 'J1939 (camiones)',
  J1979: 'J1979 / OBD-II (livianos)',
}
