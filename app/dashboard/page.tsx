import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import type { DashboardStats, OrderWithItems, OrderStatus, OrderType } from '@/types'
import { DashboardContent } from './DashboardContent'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch the owner's store
  const store = await prisma.stores.findFirst({
    where: { owner_id: user.id },
    select: { id: true, name: true },
  })

  if (!store) redirect('/onboarding')

  // Fetch recent orders with items and profile info
  const rawOrders = await prisma.orders.findMany({
    where: { store_id: store.id },
    include: {
      order_items: true,
      store: { select: { id: true, name: true, slug: true, phone: true } },
      user: { select: { first_name: true, last_name: true, email: true, phone: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  })

  const orders: OrderWithItems[] = rawOrders.map((o) => ({
    id: o.id,
    user_id: o.user_id,
    store_id: o.store_id,
    status: o.status as OrderStatus,
    order_type: o.order_type as OrderType,
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    delivery_fee: Number(o.delivery_fee),
    total: Number(o.total),
    delivery_address: o.delivery_address as Record<string, string> | null,
    customer_notes: o.customer_notes,
    store_notes: o.store_notes,
    payment_intent_id: o.payment_intent_id,
    paid_at: o.paid_at ? o.paid_at.toISOString() : null,
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
    order_items: o.order_items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      store_product_id: item.store_product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      created_at: item.created_at.toISOString(),
    })),
    store: o.store,
    profile: o.user
      ? {
          first_name: o.user.first_name,
          last_name: o.user.last_name,
          email: o.user.email,
          phone: o.user.phone,
        }
      : undefined,
  }))

  // Get today's stats
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayOrders = await prisma.orders.findMany({
    where: {
      store_id: store.id,
      created_at: { gte: todayStart },
    },
    select: { total: true, status: true },
  })

  // Count low stock products
  const lowStockCount = await prisma.store_products.count({
    where: {
      store_id: store.id,
      is_available: true,
      quantity: { lte: 5 },
    },
  })

  // Count pending orders
  const pendingCount = await prisma.orders.count({
    where: {
      store_id: store.id,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  })

  const completedStatuses = ['COMPLETED', 'DELIVERED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY']
  const todayRevenue = todayOrders
    .filter((o) => completedStatuses.includes(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0)

  const stats: DashboardStats = {
    todayRevenue,
    todayOrders: todayOrders.length,
    lowStockCount,
    pendingOrders: pendingCount,
  }

  return (
    <DashboardContent
      storeId={store.id}
      storeName={store.name}
      initialOrders={orders}
      initialStats={stats}
    />
  )
}
