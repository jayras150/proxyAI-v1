'use client'

// ProxyAI — Analytics Charts (Milestone 4)
// Recharts wrappers with reduced-motion support and accessible labels.
// Loaded lazily via next/dynamic — see the page usages.

import { useSyncExternalStore } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export const CHART_PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

/** Respect prefers-reduced-motion — charts render without animation. */
export function usePrefersReducedMotion(): boolean {
  const subscribe = (callback: () => void) => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    media.addEventListener('change', callback)
    return () => media.removeEventListener('change', callback)
  }
  const getSnapshot = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const getServerSnapshot = () => false
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function useChartProps() {
  const reducedMotion = usePrefersReducedMotion()
  return { isAnimationActive: !reducedMotion }
}

interface BaseChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  yKey: string
  yLabel?: string
  height?: number
  color?: string
}

export function AnalyticsLineChart({
  data,
  xKey,
  yKey,
  yLabel,
  height = 240,
  color = '#2563eb',
}: BaseChartProps) {
  const { isAnimationActive } = useChartProps()
  return (
    <div role="img" aria-label={`Line chart of ${yLabel ?? yKey}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} />
          <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} width={56} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            name={yLabel ?? yKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={isAnimationActive}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnalyticsAreaChart({
  data,
  xKey,
  yKey,
  yLabel,
  height = 240,
  color = '#2563eb',
}: BaseChartProps) {
  const { isAnimationActive } = useChartProps()
  return (
    <div role="img" aria-label={`Area chart of ${yLabel ?? yKey}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} />
          <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} width={56} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey={yKey}
            name={yLabel ?? yKey}
            stroke={color}
            fill={`url(#grad-${yKey})`}
            strokeWidth={2}
            isAnimationActive={isAnimationActive}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnalyticsBarChart({
  data,
  xKey,
  yKey,
  yLabel,
  height = 240,
  color = '#2563eb',
}: BaseChartProps) {
  const { isAnimationActive } = useChartProps()
  return (
    <div role="img" aria-label={`Bar chart of ${yLabel ?? yKey}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.6} width={56} />
          <Tooltip />
          <Bar dataKey={yKey} name={yLabel ?? yKey} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={isAnimationActive} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface PieSlice {
  name: string
  value: number
}

export function AnalyticsPieChart({
  data,
  height = 240,
}: {
  data: PieSlice[]
  height?: number
}) {
  const { isAnimationActive } = useChartProps()
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div role="img" aria-label={`Pie chart: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            isAnimationActive={isAnimationActive}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${entry.name}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {total === 0 && <p className="text-center text-sm text-zinc-500">No data</p>}
    </div>
  )
}
