export type Reading = {
  id: number
  created_at: string
  temperatura: number
  ph: number
  tds: number
  alerta_ativo: boolean
}

export type Period = '15m' | '1h' | '24h' | 'all'
export type Severity = 'ok' | 'warning' | 'critical'

export type SensorStatus = {
  label: string
  severity: Severity
}

export type EventEntry = {
  id: string
  title: string
  detail: string
  time: Date
  kind: 'success' | 'warning' | 'info'
}
