import type { Period, Reading, SensorStatus, Severity } from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

export const PAGE_SIZE = 1000

export function sortByCreatedAt(readings: Reading[]): Reading[] {
  return [...readings].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  )
}

export function mergeReadings(current: Reading[], incoming: Reading[]): Reading[] {
  const byId = new Map<number, Reading>()
  current.forEach((reading) => byId.set(reading.id, reading))
  incoming.forEach((reading) => byId.set(reading.id, reading))
  return sortByCreatedAt([...byId.values()])
}

export function makeDemoReadings(): Reading[] {
  const now = Date.now()
  return Array.from({ length: 144 }, (_, index) => {
    const elapsedMinutes = (143 - index) * 10
    const drift = index / 143
    return {
      id: index + 1,
      created_at: new Date(now - elapsedMinutes * 60_000).toISOString(),
      temperatura: Number((27.08 + Math.sin(index / 7) * 0.28 + Math.cos(index / 19) * 0.08).toFixed(2)),
      ph: Number((7.08 + Math.sin(index / 11) * 0.14 + Math.cos(index / 21) * 0.05).toFixed(2)),
      tds: Math.round(248 + Math.sin(index / 13) * 24 + Math.cos(index / 8) * 7 - drift * 4),
      alerta_ativo: index === 30 || index === 79,
    }
  })
}

export async function fetchRecentReadings(limit = 250): Promise<Reading[]> {
  if (!supabase) return makeDemoReadings()
  const { data, error } = await supabase
    .from('leituras_aquario')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return sortByCreatedAt((data ?? []) as Reading[])
}

export async function fetchReadingsForPeriod(period: Period): Promise<Reading[]> {
  if (!supabase) return makeDemoReadings()
  const durationByPeriod: Partial<Record<Period, number>> = {
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '24h': 24 * 60 * 60_000,
  }
  const since = durationByPeriod[period]
    ? new Date(Date.now() - durationByPeriod[period]!).toISOString()
    : null

  const collected: Reading[] = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('leituras_aquario')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (since) query = query.gte('created_at', since)

    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as Reading[]
    collected.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return sortByCreatedAt(collected)
}

export function getSensorStatus(
  sensor: 'temperatura' | 'ph' | 'tds',
  value: number,
): SensorStatus {
  if (sensor === 'temperatura') {
    if (value < 26) return { label: 'BAIXA', severity: 'warning' }
    if (value > 28) return { label: 'ALTA', severity: 'critical' }
  } else if (sensor === 'ph') {
    if (value < 6.5) return { label: 'ÁCIDO', severity: 'warning' }
    if (value > 7.5) return { label: 'ALCALINO', severity: 'critical' }
  } else {
    if (value < 150) return { label: 'BAIXO', severity: 'warning' }
    if (value > 350) return { label: 'ALTO', severity: 'critical' }
  }
  return { label: 'OK', severity: 'ok' }
}

export function getOverallSeverity(reading: Reading): Severity {
  const severities = [
    getSensorStatus('temperatura', reading.temperatura).severity,
    getSensorStatus('ph', reading.ph).severity,
    getSensorStatus('tds', reading.tds).severity,
  ]
  if (severities.includes('critical')) return 'critical'
  if (reading.alerta_ativo || severities.includes('warning')) return 'warning'
  return 'ok'
}

export function getOutOfRangeSensors(reading: Reading): string[] {
  const checks: Array<[string, 'temperatura' | 'ph' | 'tds', number]> = [
    ['Temperatura', 'temperatura', reading.temperatura],
    ['pH', 'ph', reading.ph],
    ['TDS', 'tds', reading.tds],
  ]
  return checks
    .filter(([, sensor, value]) => getSensorStatus(sensor, value).severity !== 'ok')
    .map(([name, sensor, value]) => {
      const status = getSensorStatus(sensor, value).label
      const formatted = sensor === 'temperatura' ? `${value.toFixed(1)} °C` : sensor === 'tds' ? `${Math.round(value)} ppm` : value.toFixed(2)
      return `${name} ${status.toLowerCase()} (${formatted})`
    })
}

export function getPeriodStart(period: Period, now = Date.now()): number | null {
  const duration: Partial<Record<Period, number>> = {
    '15m': 15 * 60_000,
    '1h': 60 * 60_000,
    '24h': 24 * 60 * 60_000,
  }
  return duration[period] ? now - duration[period]! : null
}

export function demoMode(): boolean {
  return !isSupabaseConfigured
}
