'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Package,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useDashboard } from '../DashboardContext'
import type { OrderWithItems, OrderStatus } from '@/types'

const TABS: { label: string; value: OrderStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Preparing', value: 'PREPARING' },
  { label: 'Ready', value: 'READY_FOR_PICKUP' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const STATUS_FLOW: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
]

export default function OrdersPage() {
  const { storeId } = useDashboard()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null)

  // Fetch orders
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      const supabase = createClient()

      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          store:stores!orders_store_id_fkey (id, name, slug, phone),
          profile:profiles!orders_user_id_fkey (first_name, last_name, email, phone)
        `)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      setOrders((data as OrderWithItems[]) ?? [])
      setLoading(false)
    }

    fetchOrders()
  }, [storeId])

  const handleUpdateStatus = useCallback(
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

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    // Tab filter
    if (activeTab !== 'ALL' && order.status !== activeTab) return false

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const customerName = order.profile
        ? `${order.profile.first_name} ${order.profile.last_name}`.toLowerCase()
        : ''
      const orderId = order.id.toLowerCase()
      const itemNames =
        order.order_items?.map((i) => i.product_name.toLowerCase()).join(' ') ?? ''

      return (
        customerName.includes(q) ||
        orderId.includes(q) ||
        itemNames.includes(q)
      )
    }

    return true
  })

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Orders</h1>
          <p className="text-sm text-secondary-500">
            Manage and track all your store orders.
          </p>
        </div>
        <Badge variant="default">
          {orders.length} total
        </Badge>
      </div>

      {/* Tab filters + search */}
      <div className="bg-white border-b border-secondary-200 px-6 py-3 space-y-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <Input
          placeholder="Search by customer, order ID, or product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No orders found"
            description={
              activeTab !== 'ALL'
                ? `No ${activeTab.toLowerCase().replace('_', ' ')} orders found.`
                : searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Orders will appear here when customers place them.'
            }
          />
        ) : (
          <div className="space-y-2">
            {/* Table header (desktop) */}
            <div className="hidden rounded-lg bg-secondary-100 px-4 py-2.5 text-xs font-medium text-secondary-500 uppercase tracking-wider md:grid md:grid-cols-12 md:gap-4">
              <span className="col-span-2">Order ID</span>
              <span className="col-span-3">Customer</span>
              <span className="col-span-3">Items</span>
              <span className="col-span-1">Total</span>
              <span className="col-span-1">Date</span>
              <span className="col-span-1">Status</span>
              <span className="col-span-1" />
            </div>

            {filteredOrders.map((order) => {
              const customerName = order.profile
                ? `${order.profile.first_name} ${order.profile.last_name}`
                : 'Customer'
              const itemSummary =
                order.order_items
                  ?.slice(0, 2)
                  .map((i) => i.product_name)
                  .join(', ') ?? ''
              const moreItems =
                (order.order_items?.length ?? 0) > 2
                  ? ` +${(order.order_items?.length ?? 0) - 2}`
                  : ''

              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full rounded-xl border border-secondary-200 bg-white p-4 text-left transition-all hover:shadow-md md:grid md:grid-cols-12 md:items-center md:gap-4"
                >
                  {/* Mobile layout */}
                  <div className="flex items-start justify-between gap-3 md:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-secondary-900 text-sm">
                          {customerName}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-secondary-500 truncate">
                        #{order.id.slice(0, 8)} &middot;{' '}
                        {order.order_items?.length ?? 0} item
                        {(order.order_items?.length ?? 0) !== 1 ? 's' : ''}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-sm font-semibold text-secondary-900">
                          {formatPrice(order.total)}
                        </span>
                        <span className="text-xs text-secondary-400">
                          {formatDistanceToNow(new Date(order.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-secondary-400" />
                  </div>

                  {/* Desktop layout */}
                  <span className="hidden text-sm font-mono text-secondary-500 md:col-span-2 md:block truncate">
                    #{order.id.slice(0, 8)}
                  </span>
                  <span className="hidden text-sm font-medium text-secondary-900 md:col-span-3 md:block truncate">
                    {customerName}
                  </span>
                  <span className="hidden text-sm text-secondary-500 md:col-span-3 md:block truncate">
                    {itemSummary}
                    {moreItems}
                  </span>
                  <span className="hidden text-sm font-semibold text-secondary-900 md:col-span-1 md:block">
                    {formatPrice(order.total)}
                  </span>
                  <span className="hidden text-xs text-secondary-400 md:col-span-1 md:block">
                    {formatDistanceToNow(new Date(order.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                  <span className="hidden md:col-span-1 md:block">
                    <OrderStatusBadge status={order.status} />
                  </span>
                  <span className="hidden md:col-span-1 md:flex md:justify-end">
                    <ChevronRight className="h-4 w-4 text-secondary-400" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  )
}

// -- Order Detail Modal (reused pattern) --

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

        {/* Order info */}
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
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
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

        {/* Status update */}
        {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
            >
              Cancel Order
            </Button>

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
        )}
      </div>
    </Modal>
  )
}
