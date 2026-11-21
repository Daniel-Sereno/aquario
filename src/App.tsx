import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertOctagon,
  Check,
  CircleCheck,
  Database,
  Fish,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Waves,
  Wifi,
  WifiOff,
  Droplets,
} from 'lucide-react'
import { ControlPanel } from './components/ControlPanel'
import { ReadingTable } from './components/ReadingTable'
import { SensorCard } from './components/SensorCard'
import { StatusPill } from './components/StatusPill'
import {
  fetchReadingsForPeriod,
  fetchRecentReadings,
  getOverallSeverity,
  getOutOfRangeSensors,
  getPeriodStart,
  mergeReadings,
} from './lib/readings'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Period, Reading } from './types'

const TelemetryChart = lazy(() =>
  import('./components/TelemetryChart').then((module) => ({ default: module.TelemetryChart })),
)

const periods: Array<{ id: Period; label: string; compact: string }> = [
  { id: '15m', label: 'Últimos 15 min', compact: '15 min' },
  { id: '1h', label: 'Última 1 hora', compact: '1 hora' },
  { id: '24h', label: 'Últimas 24 horas', compact: '24 horas' },
  { id: 'all', label: 'Todos os registros', compact: 'Tudo' },
]

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function elapsedLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) return `há ${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h ${minutes % 60} min`
  const days = Math.floor(hours / 24)
  return `há ${days} d ${hours % 24} h`
}

function sensorWordList(sensors: string[]) {
  if (!sensors.length) return 'um alerta reportado pelo microcontrolador'
  if (sensors.length === 1) return sensors[0]
  if (sensors.length === 2) return `${sensors[0]} e ${sensors[1]}`
  return `${sensors.slice(0, -1).join(', ')} e ${sensors[sensors.length - 1]}`
}

function downloadCsv(readings: Reading[]) {
  const chronological = [...readings].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const rows = [
    ['created_at', 'temperatura_c', 'ph', 'tds_ppm', 'alerta_ativo'],
    ...chronological.map((reading) => [
      reading.created_at,
      reading.temperatura,
      reading.ph,
      reading.tds,
      reading.alerta_ativo,
    ]),
  ]
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `aquario-leituras-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [readings, setReadings] = useState<Reading[]>([])
  const [period, setPeriod] = useState<Period>('24h')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [acknowledgedReadingId, setAcknowledgedReadingId] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const reload = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [latestBatch, periodBatch] = await Promise.all([
        fetchRecentReadings(250),
        fetchReadingsForPeriod(period),
      ])
      setReadings((current) => mergeReadings(current, mergeReadings(latestBatch, periodBatch)))
      setLastUpdated(new Date())
      setError(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Erro desconhecido de conexão.'
      setError(`Não foi possível sincronizar as leituras. ${message}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([fetchRecentReadings(250), fetchReadingsForPeriod(period)])
      .then(([latestBatch, periodBatch]) => {
        if (!active) return
        setReadings((current) => mergeReadings(current, mergeReadings(latestBatch, periodBatch)))
        setLastUpdated(new Date())
      })
      .catch((caught: unknown) => {
        if (!active) return
        const message = caught instanceof Error ? caught.message : 'Erro desconhecido de conexão.'
        setError(`Não foi possível sincronizar as leituras. ${message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [period])

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('aquario-leituras-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leituras_aquario' },
        (payload) => {
          const inserted = payload.new as Reading
          if (!inserted?.created_at) return
          setReadings((current) => mergeReadings(current, [inserted]))
          setLastUpdated(new Date())
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })
    return () => {
      setRealtimeConnected(false)
      void supabase?.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    const poll = async () => {
      try {
        const recent = await fetchRecentReadings(250)
        if (!active) return
        setReadings((current) => mergeReadings(current, recent))
        setLastUpdated(new Date())
        setError(null)
      } catch (caught) {
        if (!active) return
        const message = caught instanceof Error ? caught.message : 'Falha na consulta periódica.'
        setError(`A sincronização de segurança falhou. ${message}`)
      }
    }
    const interval = window.setInterval(poll, 5_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [])

  const latest = readings.at(-1)
  const previous = readings.length > 1 ? readings.at(-2) : undefined
  const onlineAge = latest ? now - Date.parse(latest.created_at) : Number.POSITIVE_INFINITY
  const isOnline = Boolean(latest && onlineAge <= 35_000)
  const periodStart = getPeriodStart(period, now)
  const visibleReadings = useMemo(
    () => periodStart === null ? readings : readings.filter((reading) => Date.parse(reading.created_at) >= periodStart),
    [readings, periodStart],
  )
  const outOfRange = latest ? getOutOfRangeSensors(latest) : []
  const hasAlert = Boolean(latest && (latest.alerta_ativo || outOfRange.length))
  const alertAcknowledged = Boolean(latest && acknowledgedReadingId === latest.id)
  const showAlert = hasAlert && !alertAcknowledged
  const critical = latest ? getOverallSeverity(latest) === 'critical' : false
  const displayedUpdate = lastUpdated ? formatDateTime(lastUpdated) : 'Aguardando sincronização'

  function acknowledgeAlert() {
    if (latest) setAcknowledgedReadingId(latest.id)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#inicio" aria-label="Aquário IoT, início">
            <span className="brand-mark"><Fish size={20} strokeWidth={2} /></span>
            <span className="brand-name">aqua<span>scope</span></span>
          </a>
          <div className="topbar-right">
            {!isSupabaseConfigured ? (
              <StatusPill severity="neutral"><span className="status-dot" /> Modo demonstração</StatusPill>
            ) : (
              <span className={`sync-state ${realtimeConnected ? 'sync-live' : ''}`}>
                <span className="sync-icon">{realtimeConnected ? <Wifi size={14} /> : <Database size={14} />}</span>
                {realtimeConnected ? 'Realtime conectado' : 'Polling de segurança ativo'}
              </span>
            )}
            <span className="topbar-divider" />
            <span className="timezone-label">BRT <span>UTC−3</span></span>
          </div>
        </div>
      </header>

      <main className="dashboard" id="inicio">
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> AQUÁRIO PRINCIPAL <span className="eyebrow-separator">/</span> VISÃO GERAL</div>
            <h1>Aquário IoT <span>— Monitoramento &amp; Telemetria</span></h1>
            <p className="page-subtitle">Acompanhe a qualidade da água e o estado dos sensores em um só lugar.</p>
          </div>
          <div className="heading-actions">
            <div className="update-meta"><span>Última atualização</span><strong>{displayedUpdate}</strong></div>
            <button className="button button-refresh" onClick={() => void reload(true)} disabled={refreshing || loading}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Atualizando' : 'Atualizar'}</span>
            </button>
          </div>
        </section>

        {isSupabaseConfigured ? (
          <section className={`device-banner ${latest ? (isOnline ? 'device-online' : 'device-offline') : 'device-pending'}`}>
            <span className="device-status-icon">{latest ? (isOnline ? <Wifi size={16} /> : <WifiOff size={16} />) : <Database size={16} />}</span>
            <div className="device-status-copy">
              <strong>{latest ? (isOnline ? 'Arduino Online (Tempo Real)' : 'Dispositivo Offline (Operando em Buffer Local)') : 'Aguardando primeira leitura do Arduino'}</strong>
              <span>{latest ? (isOnline ? `Última coleta ${elapsedLabel(onlineAge)} · atualização a cada 5 s` : `Última sincronização ${elapsedLabel(onlineAge)} · leituras em buffer serão enviadas ao reconectar`) : 'A telemetria aparecerá assim que o dispositivo enviar os primeiros dados.'}</span>
            </div>
            {latest && <span className="device-status-time">{formatDateTime(new Date(latest.created_at))}</span>}
          </section>
        ) : (
          <section className="demo-notice">
            <span className="demo-notice-icon"><Database size={15} /></span>
            <span><strong>Prévia de demonstração.</strong> Preencha <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> para carregar dados reais.</span>
            <span className="demo-notice-end">Supabase</span>
          </section>
        )}

        {error && (
          <div className="connection-error" role="alert">
            <AlertOctagon size={17} />
            <div><strong>Falha na conexão</strong><span>{error}</span></div>
            <button onClick={() => void reload(true)}>Tentar novamente</button>
          </div>
        )}

        {showAlert && latest && (
          <section className={`critical-banner ${critical ? 'critical-banner-red' : ''}`} role="alert">
            <span className="critical-icon"><AlertOctagon size={19} /></span>
            <div className="critical-copy">
              <strong>{critical ? 'Alerta crítico — verifique os parâmetros do aquário' : 'Atenção — parâmetro fora da faixa segura'}</strong>
              <span>{latest.alerta_ativo && outOfRange.length === 0 ? 'O microcontrolador reportou um alerta ativo.' : `Sensor(es): ${sensorWordList(outOfRange)}.`} Leitura coletada às {formatDateTime(new Date(latest.created_at))}.</span>
            </div>
            <button className="critical-ack" onClick={acknowledgeAlert}><Check size={14} /> Reconhecer</button>
          </section>
        )}

        <section className="section-block" aria-labelledby="sensors-title">
          <div className="section-heading">
            <div className="section-title-wrap">
              <span className="section-marker" />
              <div><h2 id="sensors-title">Sensores em tempo real</h2><p>Valores mais recentes reportados pelo dispositivo</p></div>
            </div>
            <div className="latest-chip"><span className="live-pulse" />{latest ? `Coletado ${elapsedLabel(onlineAge)}` : loading ? 'Buscando leituras' : 'Sem dados'}</div>
          </div>
          <div className="sensor-grid">
            <SensorCard icon={Thermometer} title="Temperatura" sensor="temperatura" current={latest} previous={previous} unit="°C" decimals={1} ideal="26,0 — 28,0 °C" color="mint" />
            <SensorCard icon={Waves} title="pH da água" sensor="ph" current={latest} previous={previous} unit="pH" decimals={2} ideal="6,5 — 7,5 pH" color="blue" />
            <SensorCard icon={Droplets} title="Sólidos dissolvidos" sensor="tds" current={latest} previous={previous} unit="ppm" decimals={0} ideal="150 — 350 ppm" color="violet" />
          </div>
        </section>

        <section className="section-block history-section" aria-labelledby="history-title">
          <div className="section-heading history-heading">
            <div className="section-title-wrap">
              <span className="section-marker section-marker-blue" />
              <div><h2 id="history-title">Histórico de telemetria</h2><p>Variação dos parâmetros ao longo do tempo</p></div>
            </div>
            <div className="period-control" role="group" aria-label="Período dos gráficos">
              {periods.map(({ id, label, compact }) => <button key={id} className={period === id ? 'period-active' : ''} onClick={() => setPeriod(id)} aria-label={label} title={label} aria-pressed={period === id}><span className="period-long">{label}</span><span className="period-short">{compact}</span></button>)}
            </div>
          </div>
          <Suspense fallback={<div className="chart-loading">Preparando os gráficos…</div>}>
            <div className="chart-grid">
              <TelemetryChart title="Temperatura" subtitle="Água do aquário" data={visibleReadings} sensor="temperatura" color="#55dfa6" unit="°C" digits={1} safeMin={26} safeMax={28} domain={[24, 30]} />
              <TelemetryChart title="pH" subtitle="Acidez da água" data={visibleReadings} sensor="ph" color="#58c7ed" unit="pH" digits={2} safeMin={6.5} safeMax={7.5} domain={[5.8, 8.2]} />
              <TelemetryChart title="TDS" subtitle="Sólidos dissolvidos totais" data={visibleReadings} sensor="tds" color="#a88bf6" unit="ppm" digits={0} safeMin={150} safeMax={350} domain={[80, 420]} />
            </div>
          </Suspense>
        </section>

        <section className="section-block logs-section" aria-label="Controles e registros">
          <div className="section-heading logs-heading">
            <div className="section-title-wrap">
              <span className="section-marker section-marker-violet" />
              <div><h2>Operação &amp; registros</h2><p>Comandos do painel e últimas amostras recebidas</p></div>
            </div>
            <span className="records-count"><CircleCheck size={14} /> {visibleReadings.length.toLocaleString('pt-BR')} registros no período</span>
          </div>
          <div className="operations-grid">
            <ControlPanel alertAcknowledged={alertAcknowledged} onAcknowledge={acknowledgeAlert} />
            <ReadingTable readings={visibleReadings} loading={loading} onExport={() => downloadCsv(visibleReadings)} />
          </div>
        </section>

        <footer className="dashboard-footer">
          <div className="footer-brand"><span className="footer-mark"><Fish size={15} /></span><span>aquascope</span></div>
          <span className="footer-note"><ShieldCheck size={13} /> Monitoramento contínuo • Dados ordenados pelo horário original da coleta</span>
          <span className="footer-clock">{formatDateTime(new Date(now))} BRT</span>
        </footer>
      </main>
    </div>
  )
}

export default App
