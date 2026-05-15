import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/lib/generated/prisma'
import type {
  DashboardStats,
  AnalyticsData,
  RevenueTrendPoint,
  TopProduct,
  RecentOrder,
  LowStockProduct,
  PeakHourCell,
  RevenueByType,
  CategoryRevenue,
  InventoryItem,
  TopCustomer,
  PromotionSummary,
} from '@/types'
import { DashboardContent } from './DashboardContent'

function last7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const store = await prisma.stores.findFirst({
    where: { owner_id: user.id },
    select: { id: true, name: true },
  })
  if (!store) redirect('/onboarding')

  const storeId = store.id
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [
    todayOrders,
    lowStockCount,
    pendingCount,
    totalOrderCount,
    cancelledCount,
    rawRevenueTrend,
    rawTopProducts,
    rawRecentOrders,
    lowStockProducts,
    rawPeakHours,
    rawCustomerMetrics,
    rawFulfillment,
    rawRevenueByType,
    rawCategoryBreakdown,
    rawInventoryTurnover,
    rawTopCustomers,
    promotions,
  ] = await Promise.all([
    // Today's orders
    prisma.orders.findMany({
      where: { store_id: storeId, created_at: { gte: todayStart } },
      select: { total: true, status: true },
    }),
    // Low stock count
    prisma.store_products.count({
      where: { store_id: storeId, is_available: true, quantity: { lte: 5 } },
    }),
    // Pending orders
    prisma.orders.count({
      where: { store_id: storeId, status: { in: ['PENDING', 'CONFIRMED'] } },
    }),
    // Total orders
    prisma.orders.count({
      where: { store_id: storeId, status: { not: 'CANCELLED' } },
    }),
    // Cancelled count
    prisma.orders.count({
      where: { store_id: storeId, status: 'CANCELLED' },
    }),
    // Revenue trend (7 days)
    prisma.$queryRaw<{ date: string; revenue: number; orders: bigint }[]>`
      SELECT DATE(created_at)::text as date,
             COALESCE(SUM(total::numeric), 0)::float as revenue,
             COUNT(*) as orders
      FROM orders
      WHERE store_id = ${storeId}::uuid
        AND created_at >= ${sevenDaysAgo}
        AND status != 'CANCELLED'
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
    // Top products
    prisma.$queryRaw<{ name: string; units_sold: bigint; revenue: number }[]>`
      SELECT oi.product_name as name,
             SUM(oi.quantity) as units_sold,
             COALESCE(SUM(oi.total_price::numeric), 0)::float as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.store_id = ${storeId}::uuid AND o.status != 'CANCELLED'
      GROUP BY oi.product_name
      ORDER BY units_sold DESC
      LIMIT 5
    `,
    // Recent orders
    prisma.$queryRaw<{ id: string; customer_name: string; total: number; status: string; created_at: Date; item_count: bigint }[]>`
      SELECT o.id, CONCAT(p.first_name, ' ', p.last_name) as customer_name,
             o.total::numeric::float as total, o.status, o.created_at,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      JOIN profiles p ON o.user_id = p.id
      WHERE o.store_id = ${storeId}::uuid
      ORDER BY o.created_at DESC
      LIMIT 10
    `,
    // Low stock products
    prisma.store_products.findMany({
      where: { store_id: storeId, is_available: true, quantity: { lte: 5 } },
      select: { name: true, quantity: true, low_stock_threshold: true },
      orderBy: { quantity: 'asc' },
      take: 10,
    }),
    // Peak hours
    prisma.$queryRaw<{ hour: number; day_of_week: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour,
             EXTRACT(DOW FROM created_at)::int as day_of_week,
             COUNT(*) as count
      FROM orders
      WHERE store_id = ${storeId}::uuid AND status != 'CANCELLED'
      GROUP BY hour, day_of_week
    `,
    // Customer metrics (repeat vs new)
    prisma.$queryRaw<{ new_customers: bigint; repeat_customers: bigint }[]>`
      SELECT COUNT(CASE WHEN cnt = 1 THEN 1 END) as new_customers,
             COUNT(CASE WHEN cnt > 1 THEN 1 END) as repeat_customers
      FROM (
        SELECT user_id, COUNT(*) as cnt
        FROM orders
        WHERE store_id = ${storeId}::uuid AND status != 'CANCELLED'
        GROUP BY user_id
      ) t
    `,
    // Avg fulfillment time
    prisma.$queryRaw<{ avg_minutes: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60)::float as avg_minutes
      FROM orders
      WHERE store_id = ${storeId}::uuid AND status IN ('COMPLETED', 'DELIVERED')
    `,
    // Revenue by order type
    prisma.$queryRaw<{ type: string; revenue: number; count: bigint }[]>`
      SELECT order_type as type,
             COALESCE(SUM(total::numeric), 0)::float as revenue,
             COUNT(*) as count
      FROM orders
      WHERE store_id = ${storeId}::uuid AND status != 'CANCELLED'
      GROUP BY order_type
    `,
    // Category breakdown
    prisma.$queryRaw<{ category: string; revenue: number; count: bigint }[]>`
      SELECT COALESCE(sp.category, 'Other') as category,
             COALESCE(SUM(oi.total_price::numeric), 0)::float as revenue,
             SUM(oi.quantity) as count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN store_products sp ON oi.store_product_id = sp.id
      WHERE o.store_id = ${storeId}::uuid AND o.status != 'CANCELLED'
      GROUP BY sp.category
      ORDER BY revenue DESC
    `,
    // Inventory turnover
    prisma.$queryRaw<{ name: string; current_stock: number; category: string; units_sold: bigint }[]>`
      SELECT sp.name, sp.quantity::int as current_stock,
             COALESCE(sp.category, 'Other') as category,
             COALESCE(SUM(oi.quantity), 0)::bigint as units_sold
      FROM store_products sp
      LEFT JOIN order_items oi ON sp.id = oi.store_product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'CANCELLED'
      WHERE sp.store_id = ${storeId}::uuid AND sp.is_available = true
      GROUP BY sp.id, sp.name, sp.quantity, sp.category
      ORDER BY units_sold DESC
      LIMIT 10
    `,
    // Customer leaderboard
    prisma.$queryRaw<{ name: string; total_spent: number; order_count: bigint }[]>`
      SELECT CONCAT(p.first_name, ' ', p.last_name) as name,
             COALESCE(SUM(o.total::numeric), 0)::float as total_spent,
             COUNT(*) as order_count
      FROM orders o
      JOIN profiles p ON o.user_id = p.id
      WHERE o.store_id = ${storeId}::uuid AND o.status != 'CANCELLED'
      GROUP BY p.id, p.first_name, p.last_name
      ORDER BY total_spent DESC
      LIMIT 5
    `,
    // Active promotions
    prisma.promotions.findMany({
      where: { store_id: storeId },
      select: { title: true, discount_percent: true, discount_amount: true, is_active: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ])

  // Build stats
  const completedStatuses = ['COMPLETED', 'DELIVERED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY']
  const todayRevenue = todayOrders
    .filter((o) => completedStatuses.includes(o.status))
    .reduce((sum, o) => sum + Number(o.total), 0)

  const allOrders = totalOrderCount + cancelledCount
  const cancellationRate = allOrders > 0 ? (cancelledCount / allOrders) * 100 : 0

  const customerRow = rawCustomerMetrics[0]
  const newCust = Number(customerRow?.new_customers ?? 0)
  const repeatCust = Number(customerRow?.repeat_customers ?? 0)
  const totalCust = newCust + repeatCust
  const repeatPct = totalCust > 0 ? (repeatCust / totalCust) * 100 : 0

  const allRevenue = rawRevenueTrend.reduce((s, r) => s + r.revenue, 0)
  const allOrderCount = rawRevenueTrend.reduce((s, r) => s + Number(r.orders), 0)
  const avgOrderValue = allOrderCount > 0 ? allRevenue / allOrderCount : 0

  const stats: DashboardStats = {
    todayRevenue,
    todayOrders: todayOrders.length,
    lowStockCount,
    pendingOrders: pendingCount,
    avgOrderValue,
    cancellationRate,
    repeatCustomerPct: repeatPct,
    avgFulfillmentMinutes: rawFulfillment[0]?.avg_minutes ?? 0,
  }

  // Build revenue trend with zero-fill for missing days
  const trendMap = new Map(rawRevenueTrend.map((r) => [r.date, r]))
  const revenueTrend: RevenueTrendPoint[] = last7Days().map((date) => {
    const row = trendMap.get(date)
    const revenue = row?.revenue ?? 0
    const orders = Number(row?.orders ?? 0)
    return {
      date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue,
      orders,
      avgOrderValue: orders > 0 ? revenue / orders : 0,
    }
  })

  const analytics: AnalyticsData = {
    revenueTrend,
    topProducts: rawTopProducts.map((r) => ({
      name: r.name,
      unitsSold: Number(r.units_sold),
      revenue: r.revenue,
    })),
    recentOrders: rawRecentOrders.map((r) => ({
      id: r.id,
      customerName: r.customer_name?.trim() || 'Customer',
      total: r.total,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      itemCount: Number(r.item_count),
    })),
    lowStockProducts: lowStockProducts.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      threshold: p.low_stock_threshold ?? 5,
    })),
    peakHours: rawPeakHours.map((r) => ({
      hour: r.hour,
      dayOfWeek: r.day_of_week,
      count: Number(r.count),
    })),
    revenueByType: rawRevenueByType.map((r) => ({
      type: r.type,
      revenue: r.revenue,
      count: Number(r.count),
    })),
    categoryBreakdown: rawCategoryBreakdown.map((r) => ({
      category: r.category,
      revenue: r.revenue,
      count: Number(r.count),
    })),
    inventoryTurnover: rawInventoryTurnover.map((r) => ({
      name: r.name,
      unitsSold: Number(r.units_sold),
      currentStock: r.current_stock,
      category: r.category,
    })),
    topCustomers: rawTopCustomers.map((r) => ({
      name: r.name?.trim() || 'Customer',
      totalSpent: r.total_spent,
      orderCount: Number(r.order_count),
    })),
    promotions: promotions.map((p) => ({
      title: p.title ?? 'Untitled',
      discountPercent: p.discount_percent ? Number(p.discount_percent) : null,
      discountAmount: p.discount_amount ? Number(p.discount_amount) : null,
      isActive: p.is_active,
    })),
  }

  return (
    <DashboardContent
      storeName={store.name}
      stats={stats}
      analytics={analytics}
    />
  )
}
