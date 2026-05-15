'use client'

import { cn } from '@/lib/utils'
import type { PeakHourCell } from '@/types'

interface PeakHoursMapProps {
  data: PeakHourCell[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getIntensity(count: number, max: number): string {
  if (max === 0 || count === 0) return 'bg-secondary-50'
  const ratio = count / max
  if (ratio > 0.75) return 'bg-green-500'
  if (ratio > 0.5) return 'bg-green-400'
  if (ratio > 0.25) return 'bg-green-300'
  return 'bg-green-100'
}

function formatHour(h: number): string {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
}

export function PeakHoursMap({ data }: PeakHoursMapProps) {
  const grid = new Map<string, number>()
  let max = 0
  for (const cell of data) {
    const key = `${cell.dayOfWeek}-${cell.hour}`
    grid.set(key, cell.count)
    if (cell.count > max) max = cell.count
  }

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-secondary-400">
        No order data yet
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex gap-px mb-1 ml-10">
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <div
              key={h}
              className="text-[10px] text-secondary-400"
              style={{ width: `${(3 / 24) * 100}%` }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-px mb-px">
            <div className="w-10 text-xs text-secondary-500 text-right pr-2 shrink-0">
              {day}
            </div>
            {HOURS.map((hour) => {
              const count = grid.get(`${dayIdx}-${hour}`) ?? 0
              return (
                <div
                  key={hour}
                  className={cn(
                    'flex-1 aspect-square rounded-sm transition-colors',
                    getIntensity(count, max),
                  )}
                  title={`${day} ${formatHour(hour)}: ${count} orders`}
                />
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[10px] text-secondary-400 mr-1">Less</span>
          <div className="h-3 w-3 rounded-sm bg-secondary-50" />
          <div className="h-3 w-3 rounded-sm bg-green-100" />
          <div className="h-3 w-3 rounded-sm bg-green-300" />
          <div className="h-3 w-3 rounded-sm bg-green-400" />
          <div className="h-3 w-3 rounded-sm bg-green-500" />
          <span className="text-[10px] text-secondary-400 ml-1">More</span>
        </div>
      </div>
    </div>
  )
}
