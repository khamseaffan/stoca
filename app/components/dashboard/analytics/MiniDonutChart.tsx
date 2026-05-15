'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

interface DonutSegment {
  name: string
  value: number
}

interface MiniDonutChartProps {
  data: DonutSegment[]
  colors: string[]
}

export function MiniDonutChart({ data, colors }: MiniDonutChartProps) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-secondary-400">
        No data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={192}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={75}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '13px',
          }}
          formatter={(value: number) => [`$${value.toFixed(2)}`]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
