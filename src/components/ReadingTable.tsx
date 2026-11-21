import { AlertTriangle, Download, History, Waves } from 'lucide-react'
import type { Reading, Severity } from '../types'
import { getOverallSeverity } from '../lib/readings'

function number(value: number, digits = 1) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function rowStatus(reading: Reading): { label: string; severity: Severity } {
  const severity = getOverallSeverity(reading)
  if (reading.alerta_ativo && severity === 'ok') return { label: 'ALERTA', severity: 'warning' }
  if (severity === 'critical') return { label: 'CRÍTICO', severity }
  if (severity === 'warning') return { label: 'ATENÇÃO', severity }
  return { label: 'NORMAL', severity }
}

export function ReadingTable({
  readings,
  loading,
  onExport,
}: {
  readings: Reading[]
  loading: boolean
  onExport: () => void
}) {
  const latestFirst = [...readings]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 20)

  return (
    <section className="panel-card readings-panel">
      <div className="panel-heading readings-heading">
        <div className="heading-title-wrap">
          <span className="panel-icon"><History size={17} /></span>
          <div>
            <h2>Leituras recentes</h2>
            <p>Últimas 20 amostras • ordenadas pela coleta</p>
          </div>
        </div>
        <button className="button button-secondary export-button" onClick={onExport} disabled={!readings.length}>
          <Download size={15} /> <span>Exportar CSV</span>
        </button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Horário da coleta</th>
              <th>Temperatura</th>
              <th>pH</th>
              <th>TDS</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {latestFirst.map((reading) => {
              const status = rowStatus(reading)
              return (
                <tr key={reading.id} className={reading.alerta_ativo || status.severity !== 'ok' ? `reading-row-${status.severity}` : ''}>
                  <td className="time-cell">{timestamp(reading.created_at)}</td>
                  <td>{number(reading.temperatura)} <span className="table-unit">°C</span></td>
                  <td>{number(reading.ph, 2)}</td>
                  <td>{number(reading.tds, 0)} <span className="table-unit">ppm</span></td>
                  <td>
                    <span className={`table-status severity-${status.severity}`}>
                      {(reading.alerta_ativo || status.severity !== 'ok') && <AlertTriangle size={12} />}
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!latestFirst.length && (
          <div className="table-empty">
            {loading ? <span className="loading-spinner" /> : <Waves size={23} />}
            <span>{loading ? 'Carregando leituras…' : 'Nenhuma leitura encontrada neste período.'}</span>
          </div>
        )}
      </div>
      <div className="table-footnote"><span className="table-footnote-dot" /> Horários exibidos em America/Sao_Paulo</div>
    </section>
  )
}
