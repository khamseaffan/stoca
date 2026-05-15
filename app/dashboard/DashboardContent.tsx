'use client'

import {
  DollarSign,
  ShoppingCart,
  Clock,
  AlertTriangle,
  TrendingUp,
  XCircle,
  Users,
  Timer,
  MessageSquare,
  Package,
  Crown,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
} from 'lucide-react'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge, OrderStatusBadge } from '@/components/ui/Badge'
import { RevenueChart } from '@/components/dashboard/analytics/RevenueChart'
import { MiniDonutChart } from '@/components/dashboard/analytics/MiniDonutChart'
import { PeakHoursMap } from '@/components/dashboard/analytics/PeakHoursMap'
import type {
  DashboardStats,
  AnalyticsData,
  TopProduct,
  RecentOrder,
  LowStockProduct,
  InventoryItem,
  TopCustomer,
  PromotionSummary,
  OrderStatus,
} from '@/types'

interface DashboardContentProps {
  storeName: string
  stats: DashboardStats
  analytics: AnalyticsData
}

// -- Stat cards --

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtitle?: string
}) {
  return (
    <Card padding="md" className="hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', color)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-secondary-900 leading-tight">{value}</p>
          <p className="text-xs text-secondary-500">{label}</p>
          {subtitle && <p className="text-xs text-secondary-400">{subtitle}</p>}
        </div>
      </div>
    </Card>
  )
}

// -- Section header --

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-secondary-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-secondary-500">{subtitle}</p>}
    </div>
  )
}

// -- Top products table --

function TopProductsList({ products }: { products: TopProduct[] }) {
  if (products.length === 0) {
    return <p className="text-sm text-secondary-400 py-8 text-center">No sales data yet</p>
  }
  return (
    <div className="divide-y divide-secondary-100">
      {products.map((p, i) => (
        <div key={p.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            i === 0 ? 'bg-amber-100 text-amber-700' :
            i === 1 ? 'bg-secondary-100 text-secondary-600' :
            i === 2 ? 'bg-orange-100 text-orange-700' :
            'bg-secondary-50 text-secondary-400'
          )}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900 truncate">{p.name}</p>
            <p className="text-xs text-secondary-400">{p.unitsSold} sold</p>
          </div>
          <span className="text-sm font-semibold text-secondary-900">{formatPrice(p.revenue)}</span>
        </div>
      ))}
    </div>
  )
}

// -- Recent orders list --

function RecentOrdersList({ orders }: { orders: RecentOrder[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-secondary-400 py-8 text-center">No orders yet</p>
  }
  return (
    <div className="divide-y divide-secondary-100">
      {orders.map((o) => (
        <div key={o.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-100">
            <ShoppingCart className="h-4 w-4 text-secondary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900 truncate">{o.customerName}</p>
            <p className="text-xs text-secondary-400">
              {o.itemCount} item{o.itemCount !== 1 ? 's' : ''} &middot; {formatDate(o.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-secondary-900">{formatPrice(o.total)}</p>
            <OrderStatusBadge status={o.status as OrderStatus} />
          </div>
        </div>
      ))}
    </div>
  )
}

// -- Low stock list --

function LowStockList({ products }: { products: LowStockProduct[] }) {
  if (products.length === 0) {
    return <p className="text-sm text-green-600 py-8 text-center">All products well-stocked</p>
  }
  return (
    <div className="divide-y divide-secondary-100">
      {products.map((p) => {
        const critical = p.quantity <= 2
        return (
          <div key={p.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              critical ? 'bg-red-100' : 'bg-amber-100'
            )}>
              <AlertTriangle className={cn('h-4 w-4', critical ? 'text-red-500' : 'text-amber-500')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 truncate">{p.name}</p>
              <p className="text-xs text-secondary-400">Threshold: {p.threshold}</p>
            </div>
            <Badge variant={critical ? 'danger' : 'warning'}>
              {p.quantity} left
            </Badge>
          </div>
        )
      })}
    </div>
  )
}

// -- Customer leaderboard --

function CustomerLeaderboard({ customers }: { customers: TopCustomer[] }) {
  if (customers.length === 0) {
    return <p className="text-sm text-secondary-400 py-8 text-center">No customer data yet</p>
  }
  return (
    <div className="divide-y divide-secondary-100">
      {customers.map((c, i) => (
        <div key={c.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            i === 0 ? 'bg-amber-100' : 'bg-secondary-100'
          )}>
            {i === 0 ? <Crown className="h-4 w-4 text-amber-600" /> : <Users className="h-4 w-4 text-secondary-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900 truncate">{c.name}</p>
            <p className="text-xs text-secondary-400">{c.orderCount} order{c.orderCount !== 1 ? 's' : ''}</p>
          </div>
          <span className="text-sm font-semibold text-secondary-900">{formatPrice(c.totalSpent)}</span>
        </div>
      ))}
    </div>
  )
}

// -- Inventory turnover --

function InventoryTurnoverList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-secondary-400 py-8 text-center">No inventory data</p>
  }
  return (
    <div className="divide-y divide-secondary-100">
      {items.map((item) => {
        const fast = item.unitsSold > 0 && item.currentStock <= item.unitsSold
        return (
          <div key={item.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              fast ? 'bg-green-100' : 'bg-secondary-100'
            )}>
              {fast
                ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                : <ArrowDownRight className="h-4 w-4 text-secondary-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary-900 truncate">{item.name}</p>
              <p className="text-xs text-secondary-400">{item.category}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-secondary-500">{item.unitsSold} sold</p>
              <p className="text-xs text-secondary-400">{item.currentStock} in stock</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -- Promotion performance --

function PromotionList({ promotions }: { promotions: PromotionSummary[] }) {
  if (promotions.length === 0) {
    return <p className="text-sm text-secondary-400 py-8 text-center">No promotions yet</p>
  }
  return (
    <div className="divide-y divide-secondary-100">
      {promotions.map((p) => (
        <div key={p.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            p.isActive ? 'bg-green-100' : 'bg-secondary-100'
          )}>
            <Tag className={cn('h-4 w-4', p.isActive ? 'text-green-600' : 'text-secondary-400')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-secondary-900 truncate">{p.title}</p>
            <p className="text-xs text-secondary-400">
              {p.discountPercent ? `${p.discountPercent}% off` : p.discountAmount ? `$${p.discountAmount.toFixed(2)} off` : 'Custom'}
            </p>
          </div>
          <Badge variant={p.isActive ? 'success' : 'default'}>
            {p.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ))}
    </div>
  )
}

// -- Donut legend --

function DonutLegend({ items }: { items: { name: string; color: string; value: string }[] }) {
  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-xs">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-secondary-600 flex-1 truncate">{item.name}</span>
          <span className="text-secondary-900 font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// -- Main dashboard --

const DONUT_COLORS_TYPE = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']
const DONUT_COLORS_CATEGORY = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const DONUT_COLORS_CUSTOMERS = ['#3b82f6', '#e2e8f0']

export function DashboardContent({ storeName, stats, analytics }: DashboardContentProps) {
  const formatMinutes = (m: number) => {
    if (m < 1) return '<1 min'
    if (m < 60) return `${Math.round(m)} min`
    const h = Math.floor(m / 60)
    const mins = Math.round(m % 60)
    return mins > 0 ? `${h}h ${mins}m` : `${h}h`
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-5 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-secondary-500">
            {storeName} &mdash; analytics overview
          </p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-dashboard-chat'))}
          className={cn(
            'hidden items-center gap-2 rounded-lg border border-secondary-200 px-4 py-2.5 text-sm font-medium text-secondary-700 transition-all lg:flex',
            'hover:bg-secondary-50 hover:border-secondary-300 hover:shadow-sm',
          )}
        >
          <MessageSquare className="h-4 w-4" />
          AI Assistant
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 space-y-8">

          {/* ── Row 1: Stat cards ── */}
          <section>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
              <StatCard label="Revenue" value={formatPrice(stats.todayRevenue)} icon={DollarSign} color="text-green-600 bg-green-100" subtitle="today" />
              <StatCard label="Orders" value={stats.todayOrders.toString()} icon={ShoppingCart} color="text-blue-600 bg-blue-100" subtitle="today" />
              <StatCard label="Pending" value={stats.pendingOrders.toString()} icon={Clock} color="text-amber-600 bg-amber-100" />
              <StatCard label="Low Stock" value={stats.lowStockCount.toString()} icon={AlertTriangle} color="text-red-600 bg-red-100" />
              <StatCard label="Avg Order" value={formatPrice(stats.avgOrderValue)} icon={TrendingUp} color="text-purple-600 bg-purple-100" />
              <StatCard
                label="Fulfillment"
                value={formatMinutes(stats.avgFulfillmentMinutes)}
                icon={Timer}
                color="text-indigo-600 bg-indigo-100"
                subtitle="avg time"
              />
            </div>
          </section>

          {/* ── Row 2: Revenue chart + donuts ── */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card padding="md" className="lg:col-span-2">
              <SectionHeader title="Revenue & Avg Order Value" subtitle="Last 7 days" />
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                  <div className="h-2 w-6 rounded-full bg-green-500" /> Revenue
                </div>
                <div className="flex items-center gap-1.5 text-xs text-secondary-500">
                  <div className="h-0.5 w-6 border-t-2 border-dashed border-purple-500" /> AOV
                </div>
              </div>
              <RevenueChart data={analytics.revenueTrend} />
            </Card>

            <div className="space-y-6">
              <Card padding="md">
                <SectionHeader title="Orders by Type" />
                <MiniDonutChart
                  data={analytics.revenueByType.map((r) => ({ name: r.type, value: r.revenue }))}
                  colors={DONUT_COLORS_TYPE}
                />
                <DonutLegend
                  items={analytics.revenueByType.map((r, i) => ({
                    name: r.type,
                    color: DONUT_COLORS_TYPE[i % DONUT_COLORS_TYPE.length],
                    value: formatPrice(r.revenue),
                  }))}
                />
              </Card>

              <Card padding="md">
                <SectionHeader title="Customer Mix" />
                <MiniDonutChart
                  data={[
                    { name: 'Repeat', value: stats.repeatCustomerPct },
                    { name: 'New', value: 100 - stats.repeatCustomerPct },
                  ]}
                  colors={DONUT_COLORS_CUSTOMERS}
                />
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-secondary-500">Repeat customers</span>
                  <span className="font-semibold text-secondary-900">{stats.repeatCustomerPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-500">Cancellation rate</span>
                  <span className={cn('font-semibold', stats.cancellationRate > 10 ? 'text-red-600' : 'text-secondary-900')}>
                    {stats.cancellationRate.toFixed(1)}%
                  </span>
                </div>
              </Card>
            </div>
          </section>

          {/* ── Row 3: Peak hours ── */}
          <section>
            <Card padding="md">
              <SectionHeader title="Peak Hours" subtitle="When your orders come in" />
              <PeakHoursMap data={analytics.peakHours} />
            </Card>
          </section>

          {/* ── Row 4: Products ── */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="md">
              <SectionHeader title="Top Selling Products" />
              <TopProductsList products={analytics.topProducts} />
            </Card>

            <Card padding="md">
              <SectionHeader title="Revenue by Category" />
              <MiniDonutChart
                data={analytics.categoryBreakdown.map((c) => ({ name: c.category, value: c.revenue }))}
                colors={DONUT_COLORS_CATEGORY}
              />
              <DonutLegend
                items={analytics.categoryBreakdown.slice(0, 6).map((c, i) => ({
                  name: c.category,
                  color: DONUT_COLORS_CATEGORY[i % DONUT_COLORS_CATEGORY.length],
                  value: formatPrice(c.revenue),
                }))}
              />
            </Card>
          </section>

          {/* ── Row 5: Orders + low stock ── */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="md">
              <SectionHeader title="Recent Orders" subtitle="Latest 10" />
              <RecentOrdersList orders={analytics.recentOrders} />
            </Card>

            <Card padding="md">
              <SectionHeader title="Low Stock Alerts" subtitle="Products below threshold" />
              <LowStockList products={analytics.lowStockProducts} />
            </Card>
          </section>

          {/* ── Row 6: Customers + inventory ── */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="md">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="h-5 w-5 text-amber-500" />
                <SectionHeader title="Top Customers" />
              </div>
              <CustomerLeaderboard customers={analytics.topCustomers} />
            </Card>

            <Card padding="md">
              <SectionHeader title="Inventory Turnover" subtitle="Sales vs stock levels" />
              <InventoryTurnoverList items={analytics.inventoryTurnover} />
            </Card>
          </section>

          {/* ── Row 7: Promotions ── */}
          <section>
            <Card padding="md">
              <SectionHeader title="Promotions" subtitle="Active and past discounts" />
              <PromotionList promotions={analytics.promotions} />
            </Card>
          </section>

        </div>
      </div>
    </div>
  )
}
