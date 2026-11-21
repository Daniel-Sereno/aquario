import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Reading } from '../types'
import { getSensorStatus } from '../lib/readings'
import { StatusPill } from './StatusPill'

type SensorKey = 'temperatura' | 'ph' | 'tds'

export function SensorCard({
  icon: Icon,
  title,
  sensor,
  current,
  previous,
  unit,
  decimals,
  ideal,
  color,
}: {
  icon: LucideIcon
  title: string
  sensor: SensorKey
  current?: Reading
  previous?: Reading
  unit: string
  decimals: number
  ideal: string
  color: 'mint' | 'blue' | 'violet'
}) {
  const value = current?.[sensor]
  const prior = previous?.[sensor]
  const status = value === undefined ? null : getSensorStatus(sensor, value)
  const delta = value === undefined || prior === undefined ? null : value - prior
  const deltaDecimals = sensor === 'tds' ? 0 : sensor === 'ph' ? 2 : 1
  const deltaText = delta === null
    ? 'Sem leitura anterior'
    : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(deltaDecimals)} ${unit}`
  const DeltaIcon = delta === null || Math.abs(delta) < 10 ** -(deltaDecimals + 1)
    ? Minus
    : delta > 0
      ? ArrowUpRight
      : ArrowDownRight

  return (
    <article className={`sensor-card sensor-card-${color}`}>
      <div className="sensor-card-top">
        <div className="sensor-label">
          <span className="sensor-icon"><Icon size={19} strokeWidth={1.8} /></span>
          <span>{title}</span>
        </div>
        {status ? <StatusPill severity={status.severity}>{status.label}</StatusPill> : <StatusPill severity="neutral">AGUARDANDO</StatusPill>}
      </div>

      <div className="sensor-reading">
        <span className="sensor-value">{value === undefined ? '—' : value.toFixed(decimals)}</span>
        <span className="sensor-unit">{unit}</span>
      </div>

      <div className="sensor-meta">
        <div className="ideal-range"><span className="meta-label">Faixa ideal</span><span>{ideal}</span></div>
        <span className="delta-indicator severity-ok">
          <DeltaIcon size={14} />
          <span>{deltaText}</span>
        </span>
      </div>
      <div className="sensor-track" aria-hidden="true"><span /></div>
    </article>
  )
}
