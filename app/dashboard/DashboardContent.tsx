'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DollarSign,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Bot,
  X,
  Check,
  Package,
  MessageSquare,
  PanelRightClose,
} from 'lucide-react'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { DashboardStats, OrderWithItems, OrderStatus } from '@/types'

// Notification sound (short beep via data URI)
const NOTIFICATION_SOUND =
  'data:audio/wav;base64,UklGRl9vT19teleXRlbXQAAAAAABAAEARB8AAIA+AAACABAAAAAA'

interface DashboardContentProps {
  storeId: string
  storeName: string
  initialOrders: OrderWithItems[]
  initialStats: DashboardStats
}

// Stat card data
function getStatCards(stats: DashboardStats) {
  return [
    {
      label: 'Today\'s Revenue',
      value: formatPrice(stats.todayRevenue),
      icon: DollarSign,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Today\'s Orders',
      value: stats.todayOrders.toString(),
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Pending',
      value: stats.pendingOrders.toString(),
      icon: Clock,
      color: 'text-amber-600 bg-amber-100',
    },
    {
      label: 'Low Stock',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-100',
    },
  ] as const
}

export function DashboardContent({
  storeId,
  storeName,
  initialOrders,
  initialStats,
}: DashboardContentProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders)
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND)
    audioRef.current.volume = 0.3
  }, [])

  // Listen for the "open chat" custom event from sidebar nav
  useEffect(() => {
    function handleOpenChat() {
      setChatOpen(true)
    }
    window.addEventListener('open-dashboard-chat', handleOpenChat)
    return () => window.removeEventListener('open-dashboard-chat', handleOpenChat)
  }, [])

  // Realtime subscription for order updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `store_id=eq.${storeId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newOrder } = await supabase
              .from('orders')
              .select(`
                *,
                order_items (*),
                store:stores!orders_store_id_fkey (id, name, slug, phone),
                profile:profiles!orders_user_id_fkey (first_name, last_name, email, phone)
              `)
              .eq('id', payload.new.id)
              .single()

            if (newOrder) {
              setOrders((prev) => [newOrder as OrderWithItems, ...prev])
              setStats((prev) => ({
                ...prev,
                todayOrders: prev.todayOrders + 1,
                pendingOrders: prev.pendingOrders + 1,
              }))

              try {
                audioRef.current?.play()
              } catch {
                // Autoplay blocked
              }

              const name = newOrder.profile
                ? `${newOrder.profile.first_name} ${newOrder.profile.last_name}`
                : 'A customer'
              toast({
                title: `New order from ${name}`,
                description: `${newOrder.order_items?.length ?? 0} items — $${Number(newOrder.total).toFixed(2)}`,
                variant: 'info',
              })
            }
          }

          if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((order) =>
                order.id === payload.new.id
                  ? { ...order, ...payload.new }
                  : order,
              ),
            )
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  const handleAcceptOrder = useCallback(
    async (orderId: string, e?: React.MouseEvent) => {
      e?.stopPropagation()
      setUpdatingOrderId(orderId)

      const supabase = createClient()
      const { error } = await supabase
        .from('orders')
        .update({ status: 'CONFIRMED' as OrderStatus })
        .eq('id', orderId)

      if (!error) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? { ...order, status: 'CONFIRMED' as OrderStatus }
              : order,
          ),
        )
        setStats((prev) => ({
          ...prev,
          pendingOrders: Math.max(0, prev.pendingOrders - 1),
        }))
        toast({ title: 'Order accepted', variant: 'success' })
      } else {
        toast({ title: 'Failed to accept order', variant: 'error' })
      }

      setUpdatingOrderId(null)
    },
    [],
  )

  const handleUpdateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (!error) {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order,
          ),
        )
        setSelectedOrder((prev) =>
          prev?.id === orderId ? { ...prev, status: newStatus } : prev,
        )
      }
    },
    [],
  )

  const statCards = getStatCards(stats)

  return (
    <>
      {/* Main content — full width, no permanent chat panel */}
      <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-5 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
            <p className="mt-0.5 text-sm text-secondary-500">
              Welcome back. Here is what is happening today.
            </p>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className={cn(
              'hidden items-center gap-2 rounded-lg border border-secondary-200 px-4 py-2.5 text-sm font-medium text-secondary-700 transition-all lg:flex',
              'hover:bg-secondary-50 hover:border-secondary-300 hover:shadow-sm',
            )}
          >
            <MessageSquare className="h-4 w-4" />
            AI Assistant
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto px-4 py-8 lg:px-8 space-y-8">

            {/* ── Stats section ── */}
            <section>
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                {statCards.map((stat) => (
                  <Card key={stat.label} padding="md" className="hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                          stat.color,
                        )}
                      >
                        <stat.icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-bold text-secondary-900 leading-tight">
                          {stat.value}
                        </p>
                        <p className="text-sm text-secondary-500 truncate">
                          {stat.label}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── Order Board section ── */}
            <section>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-secondary-900">
                    Order Board
                  </h2>
                  <p className="mt-0.5 text-sm text-secondary-500">
                    Drag orders to advance their status
                  </p>
                </div>
                <Badge variant="default">
                  {orders.length} order{orders.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {orders.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="No orders yet"
                  description="When customers place orders, they will appear here in real time."
                />
              ) : (
                <KanbanBoard
                  orders={orders}
                  onUpdateStatus={handleUpdateOrderStatus}
                  onSelectOrder={setSelectedOrder}
                />
              )}
            </section>

          </div>
        </div>
      </div>

      {/* ── Chat drawer (slide-over, all screen sizes) — always mounted to preserve history ── */}
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity',
          chatOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setChatOpen(false)}
        aria-hidden="true"
      />
      {/* Drawer panel — always rendered, translated off-screen when closed */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 sm:max-w-[420px]',
          chatOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-secondary-200 px-4 py-3">
          <h3 className="font-semibold text-secondary-900">AI Assistant</h3>
          <button
            onClick={() => setChatOpen(false)}
            className="rounded-lg p-1.5 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600 transition-colors"
            aria-label="Close chat"
          >
            <PanelRightClose className="h-5 w-5" />
          </button>
        </div>
        <ChatWindow
          storeId={storeId}
          storeName={storeName}
          className="flex-1 rounded-none border-0"
        />
      </div>

      {/* ── Floating chat button (mobile — always, desktop — only when chat closed) ── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-primary-700 hover:shadow-xl"
          aria-label="Open AI Chat"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateOrderStatus}
        />
      )}
    </>
  )
}

// -- Order Detail Modal --

const STATUS_FLOW: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
]

function OrderDetailModal({
  order,
  onClose,
  onUpdateStatus,
}: {
  order: OrderWithItems
  onClose: () => void
  onUpdateStatus: (orderId: string, status: OrderStatus) => void
}) {
  const currentIdx = STATUS_FLOW.indexOf(order.status)
  const nextStatus =
    currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentIdx + 1]
      : null

  const customerName = order.profile
    ? `${order.profile.first_name} ${order.profile.last_name}`
    : 'Customer'

  return (
    <Modal isOpen onClose={onClose} title={`Order #${order.id.slice(0, 8)}`} size="lg">
      <div className="space-y-5">
        {/* Status + Customer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-secondary-900">{customerName}</p>
            {order.profile?.email && (
              <p className="text-xs text-secondary-500">{order.profile.email}</p>
            )}
            {order.profile?.phone && (
              <p className="text-xs text-secondary-500">{order.profile.phone}</p>
            )}
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Order details */}
        <div className="rounded-lg border border-secondary-200 divide-y divide-secondary-100">
          <div className="px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-secondary-500">Type</span>
            <Badge variant="default">{order.order_type}</Badge>
          </div>
          <div className="px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-secondary-500">Date</span>
            <span className="text-secondary-900">{formatDate(order.created_at)}</span>
          </div>
          {order.customer_notes && (
            <div className="px-4 py-3 text-sm">
              <span className="text-secondary-500">Notes: </span>
              <span className="text-secondary-700">{order.customer_notes}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          <h4 className="text-sm font-medium text-secondary-900 mb-2">Items</h4>
          <div className="rounded-lg border border-secondary-200 divide-y divide-secondary-100">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-100">
                    <Package className="h-4 w-4 text-secondary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary-900">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-secondary-500">
                      Qty: {item.quantity} x {formatPrice(item.unit_price)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-secondary-900">
                  {formatPrice(item.total_price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-lg bg-secondary-50 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-secondary-500">Subtotal</span>
            <span className="text-secondary-700">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary-500">Tax</span>
            <span className="text-secondary-700">{formatPrice(order.tax)}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-secondary-500">Delivery Fee</span>
              <span className="text-secondary-700">
                {formatPrice(order.delivery_fee)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-secondary-200 pt-2 text-sm font-semibold">
            <span className="text-secondary-900">Total</span>
            <span className="text-secondary-900">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
            >
              Cancel Order
            </Button>
          )}

          <div className="ml-auto">
            {nextStatus && (
              <Button
                variant="primary"
                size="md"
                onClick={() => onUpdateStatus(order.id, nextStatus)}
              >
                Mark as{' '}
                {nextStatus
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
