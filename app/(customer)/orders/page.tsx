import Link from 'next/link'
import { Package, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { OrderStatus, OrderType } from '@/types'

interface OrderWithStore {
  id: string
  user_id: string
  store_id: string
  status: OrderStatus
  order_type: OrderType
  subtotal: number
  tax: number
  delivery_fee: number
  total: number
  customer_notes: string | null
  created_at: Date
  store: { id: string; name: string; slug: string | null }
  order_items: { id: string }[]
}

export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={Package}
          title="Sign in to view orders"
          description="You need to be logged in to see your order history."
          action={
            <Link href="/auth/login">
              <Button>Sign In</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const rawOrders = await prisma.orders.findMany({
    where: { user_id: user.id },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      order_items: { select: { id: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const typedOrders: OrderWithStore[] = rawOrders.map((o) => ({
    id: o.id,
    user_id: o.user_id,
    store_id: o.store_id,
    status: o.status as OrderStatus,
    order_type: o.order_type as OrderType,
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    delivery_fee: Number(o.delivery_fee),
    total: Number(o.total),
    customer_notes: o.customer_notes,
    created_at: o.created_at,
    store: o.store,
    order_items: o.order_items,
  }))

  if (typedOrders.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order, it will appear here."
          action={
            <Link href="/">
              <Button>Browse Stores</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-secondary-900">My Orders</h1>
      <p className="mt-1 text-sm text-secondary-500">
        {typedOrders.length} order{typedOrders.length !== 1 ? 's' : ''}
      </p>

      <div className="mt-6 space-y-3">
        {typedOrders.map((order) => (
          <Link key={order.id} href={`/orders/${order.id}`}>
            <Card
              padding="none"
              className="transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4 px-6 py-4">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100">
                  <Package className="h-5 w-5 text-secondary-400" />
                </div>

                {/* Order info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-secondary-900">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-secondary-500">
                    {order.store?.name} &middot;{' '}
                    {order.order_items?.length ?? 0} item
                    {(order.order_items?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Right side: total + date */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-secondary-900">
                    {formatPrice(order.total)}
                  </p>
                  <p className="mt-0.5 text-xs text-secondary-400">
                    {formatDate(order.created_at)}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-secondary-300" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
