import { useState } from 'react'
import { BellOff, Check, Clock3, Fan, Lightbulb, Utensils, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EventEntry } from '../types'

type ActuatorId = 'led' | 'oxygen' | 'feeder'

const actuators: Array<{ id: ActuatorId; title: string; description: string; icon: LucideIcon }> = [
  { id: 'led', title: 'Iluminação LED', description: 'Luz do aquário', icon: Lightbulb },
  { id: 'oxygen', title: 'Bomba de oxigenação', description: 'Circulação e oxigênio', icon: Fan },
  { id: 'feeder', title: 'Alimentador automático', description: 'Dosador de ração', icon: Utensils },
]

function relativeTime(date: Date, now: number) {
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000))
  if (minutes === 0) return 'agora'
  if (minutes === 1) return 'há 1 min'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `há ${hours} h`
}

export function ControlPanel({
  alertAcknowledged,
  onAcknowledge,
}: {
  alertAcknowledged: boolean
  onAcknowledge: () => void
}) {
  const [actuatorState, setActuatorState] = useState<Record<ActuatorId, boolean>>({
    led: false,
    oxygen: false,
    feeder: false,
  })
  const [events, setEvents] = useState<EventEntry[]>([])
  const [now, setNow] = useState(Date.now())

  function toggle(id: ActuatorId, title: string) {
    const next = !actuatorState[id]
    setActuatorState((current) => ({ ...current, [id]: next }))
    const event: EventEntry = {
      id: `${Date.now()}-${id}`,
      title: `${title} ${next ? 'ligada' : 'desligada'}`,
      detail: 'Ação registrada no painel local',
      time: new Date(),
      kind: 'info',
    }
    setEvents((current) => [event, ...current].slice(0, 5))
    setNow(Date.now())
  }

  function acknowledge() {
    onAcknowledge()
    const event: EventEntry = {
      id: `${Date.now()}-ack`,
      title: 'Alertas visuais reconhecidos',
      detail: 'A sinalização visual atual foi silenciada',
      time: new Date(),
      kind: 'success',
    }
    setEvents((current) => [event, ...current].slice(0, 5))
    setNow(Date.now())
  }

  return (
    <section className="panel-card controls-panel">
      <div className="panel-heading">
        <div className="heading-title-wrap">
          <span className="panel-icon"><Zap size={17} /></span>
          <div><h2>Controles manuais</h2><p>Atuadores do aquário</p></div>
        </div>
        <span className="local-only-tag">LOCAL</span>
      </div>

      <div className="actuator-list">
        {actuators.map(({ id, title, description, icon: Icon }) => {
          const enabled = actuatorState[id]
          return (
            <div className={`actuator-row ${enabled ? 'actuator-enabled' : ''}`} key={id}>
              <span className="actuator-icon"><Icon size={18} strokeWidth={1.8} /></span>
              <span className="actuator-copy"><strong>{title}</strong><small>{description}</small></span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${title}: ${enabled ? 'ligada' : 'desligada'}`}
                className={`toggle ${enabled ? 'toggle-on' : ''}`}
                onClick={() => toggle(id, title)}
              ><span /></button>
            </div>
          )
        })}
      </div>

      <p className="local-control-note">Os comandos são simulados neste painel. A tabela Supabase atual contém apenas telemetria.</p>

      <button className={`acknowledge-button ${alertAcknowledged ? 'acknowledged' : ''}`} onClick={acknowledge}>
        {alertAcknowledged ? <Check size={15} /> : <BellOff size={15} />}
        {alertAcknowledged ? 'Alertas visuais reconhecidos' : 'Reconhecer alertas visuais'}
      </button>

      <div className="event-log">
        <div className="event-log-heading"><span>Registro de eventos</span><span className="event-count">{events.length}</span></div>
        {events.length ? events.map((event) => (
          <div className="event-row" key={event.id}>
            <span className={`event-mark event-mark-${event.kind}`}><span /></span>
            <div className="event-copy"><strong>{event.title}</strong><small>{event.detail}</small></div>
            <span className="event-time"><Clock3 size={11} />{relativeTime(event.time, now)}</span>
          </div>
        )) : (
          <div className="event-empty"><Clock3 size={14} /><span>Nenhuma ação manual registrada</span></div>
        )}
      </div>
    </section>
  )
}
