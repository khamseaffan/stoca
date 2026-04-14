'use client'

import { useState, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Package, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/ui/Badge'
import type { OrderWithItems, OrderStatus } from '@/types'

// Column definitions in order
const COLUMNS: {
  id: string
  label: string
  statuses: OrderStatus[]
  color: string
  collapsedByDefault?: boolean
}[] = [
  { id: 'new', label: 'New', statuses: ['PENDING'], color: 'border-t-amber-400' },
  { id: 'confirmed', label: 'Confirmed', statuses: ['CONFIRMED'], color: 'border-t-blue-400' },
  { id: 'preparing', label: 'Preparing', statuses: ['PREPARING'], color: 'border-t-purple-400' },
  { id: 'ready', label: 'Ready', statuses: ['READY_FOR_PICKUP'], color: 'border-t-green-400' },
  {
    id: 'completed',
    label: 'Completed',
    statuses: ['COMPLETED', 'DELIVERED'],
    color: 'border-t-secondary-300',
    collapsedByDefault: true,
  },
]

// Map status to column index for forward-only enforcement
const STATUS_TO_COL_IDX: Record<string, number> = {}
COLUMNS.forEach((col, idx) => {
  for (const s of col.statuses) {
    STATUS_TO_COL_IDX[s] = idx
  }
})

// Target status when dropping into a column
const COL_TARGET_STATUS: Record<string, OrderStatus> = {
  new: 'PENDING',
  confirmed: 'CONFIRMED',
  preparing: 'PREPARING',
  ready: 'READY_FOR_PICKUP',
  completed: 'COMPLETED',
}

interface KanbanBoardProps {
  orders: OrderWithItems[]
  onUpdateStatus: (orderId: string, newStatus: OrderStatus) => void
  onSelectOrder: (order: OrderWithItems) => void
  compact?: boolean
}

export function KanbanBoard({
  orders,
  onUpdateStatus,
  onSelectOrder,
  compact = false,
}: KanbanBoardProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const col of COLUMNS) {
      if (col.collapsedByDefault) initial[col.id] = true
    }
    return initial
  })

  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const draggedOrderRef = useRef<OrderWithItems | null>(null)

  const toggleCollapse = (colId: string) => {
    setCollapsed((prev) => ({ ...prev, [colId]: !prev[colId] }))
  }

  const handleDragStart = useCallback(
    (e: React.DragEvent, order: OrderWithItems) => {
      draggedOrderRef.current = order
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', order.id)
      // Add a slight delay for the drag ghost
      const el = e.currentTarget as HTMLElement
      el.style.opacity = '0.5'
    },
    [],
  )

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '1'
    draggedOrderRef.current = null
    setDragOverCol(null)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.preventDefault()
      const order = draggedOrderRef.current
      if (!order) return

      const fromIdx = STATUS_TO_COL_IDX[order.status]
      const toIdx = COLUMNS.findIndex((c) => c.id === colId)

      // Only allow forward progression
      if (toIdx > fromIdx) {
        e.dataTransfer.dropEffect = 'move'
        setDragOverCol(colId)
      } else {
        e.dataTransfer.dropEffect = 'none'
      }
    },
    [],
  )

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.preventDefault()
      setDragOverCol(null)

      const order = draggedOrderRef.current
      if (!order) return

      const fromIdx = STATUS_TO_COL_IDX[order.status]
      const toIdx = COLUMNS.findIndex((c) => c.id === colId)

      if (toIdx > fromIdx) {
        const targetStatus = COL_TARGET_STATUS[colId]
        if (targetStatus) {
          onUpdateStatus(order.id, targetStatus)
        }
      }

      draggedOrderRef.current = null
    },
    [onUpdateStatus],
  )

  // Filter out cancelled orders
  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED')

  return (
    <div className={cn(
      'flex gap-4 overflow-x-auto pb-4',
      compact ? 'min-h-[300px]' : 'min-h-[calc(100vh-16rem)]',
    )}>
      {COLUMNS.map((col) => {
        const colOrders = activeOrders.filter((o) =>
          col.statuses.includes(o.status),
        )
        const isCollapsed = collapsed[col.id] ?? false
        const isDragOver = dragOverCol === col.id

        return (
          <div
            key={col.id}
            className={cn(
              'flex min-w-[260px] flex-1 flex-col rounded-xl border border-t-4 bg-secondary-50/50 transition-colors duration-200',
              col.color,
              isDragOver && 'bg-primary-50/60 border-primary-200',
            )}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-secondary-700">
                  {col.label}
                </h3>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary-200 px-1.5 text-xs font-medium text-secondary-600">
                  {colOrders.length}
                </span>
              </div>
              {col.collapsedByDefault && (
                <button
                  onClick={() => toggleCollapse(col.id)}
                  className="rounded p-1 text-secondary-400 hover:bg-secondary-200 hover:text-secondary-600 transition-colors"
                  aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* Cards */}
            {!isCollapsed && (
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {colOrders.length === 0 && (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-secondary-200 py-8 text-xs text-secondary-400">
                    No orders
                  </div>
                )}
                {colOrders.map((order) => (
                  <KanbanCard
                    key={order.id}
                    order={order}
                    onSelect={onSelectOrder}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({
  order,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  order: OrderWithItems
  onSelect: (order: OrderWithItems) => void
  onDragStart: (e: React.DragEvent, order: OrderWithItems) => void
  onDragEnd: (e: React.DragEvent) => void
}) {
  const customerName = order.profile
    ? `${order.profile.first_name} ${order.profile.last_name}`
    : 'Customer'

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, order)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(order)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(order)}
      role="button"
      tabIndex={0}
      className={cn(
        'group cursor-pointer rounded-lg border border-secondary-200 bg-white p-3 shadow-sm',
        'transition-all duration-150 hover:shadow-md hover:border-secondary-300',
        'active:scale-[0.98]',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-secondary-900 truncate">
          {customerName}
        </span>
        <GripVertical className="h-4 w-4 shrink-0 text-secondary-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex items-center gap-2 text-xs text-secondary-500">
        <span>
          {order.order_items?.length ?? 0} item
          {(order.order_items?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <span>&middot;</span>
        <span className="font-medium text-secondary-700">
          {formatPrice(order.total)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <OrderStatusBadge status={order.status} />
        <span className="text-[10px] text-secondary-400">
          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}
