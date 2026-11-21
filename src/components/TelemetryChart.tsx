import { Activity } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Reading } from '../types'

type ChartReading = Reading & { time: number }

function timeLabel(value: number, includeDate = false) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    ...(includeDate ? { day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function ChartTooltip({ active, payload, label, unit, digits }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
  unit: string
  digits: number
}) {
  if (!active || !payload?.length || label === undefined) return null
  return (
    <div className="chart-tooltip">
      <span>{timeLabel(label, true)}</span>
      <strong>{Number(payload[0].value).toFixed(digits)} {unit}</strong>
    </div>
  )
}

export function TelemetryChart({
  title,
  subtitle,
  data,
  sensor,
  color,
  unit,
  digits,
  safeMin,
  safeMax,
  domain,
}: {
  title: string
  subtitle: string
  data: Reading[]
  sensor: 'temperatura' | 'ph' | 'tds'
  color: string
  unit: string
  digits: number
  safeMin: number
  safeMax: number
  domain: [number, number]
}) {
  const chartData: ChartReading[] = data.map((reading) => ({
    ...reading,
    time: Date.parse(reading.created_at),
  }))

  return (
    <section className="chart-card">
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className="chart-icon"><Activity size={17} /></span>
      </div>
      {chartData.length ? (
        <div className="chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 7, left: -17, bottom: 0 }}>
              <CartesianGrid stroke="#21342e" strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value) => timeLabel(value)}
                minTickGap={28}
                tick={{ fill: '#71847d', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tick={{ fill: '#71847d', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickCount={5}
                width={42}
              />
              <Tooltip content={<ChartTooltip unit={unit} digits={digits} />} cursor={{ stroke: '#385149', strokeDasharray: '4 4' }} />
              <ReferenceLine y={safeMin} stroke="#e7b94d" strokeDasharray="4 5" strokeOpacity={0.8} />
              <ReferenceLine y={safeMax} stroke="#e7b94d" strokeDasharray="4 5" strokeOpacity={0.8} />
              <Line
                type="monotone"
                dataKey={sensor}
                stroke={color}
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: '#0d1c18', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty"><Activity size={22} /><span>Sem leituras neste período</span></div>
      )}
      <div className="chart-footer">
        <span><i className="legend-line" style={{ backgroundColor: color }} /> Telemetria</span>
        <span><i className="legend-dash" /> Faixa segura</span>
      </div>
    </section>
  )
}
