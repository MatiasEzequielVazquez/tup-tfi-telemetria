export type Tone = 'ok' | 'warn' | 'danger' | 'postponed' | 'neutral'

export interface StatusInfo {
  label: string
  /** Ícono decorativo: el significado siempre está en `label`. */
  icon: string
  tone: Tone
}

const TONE_CLASSES: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  danger: 'bg-danger-bg text-danger-fg',
  postponed: 'bg-postponed-bg text-postponed-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
}

/** Indicador de estado: texto + ícono, nunca solo color. */
const StatusBadge = ({ status }: { status: StatusInfo }) => (
  <span
    className={`inline-flex items-start gap-1 rounded-2xl px-2.5 py-0.5 text-sm font-semibold ${TONE_CLASSES[status.tone]}`}
  >
    <span aria-hidden="true">{status.icon}</span>
    {status.label}
  </span>
)

export default StatusBadge
