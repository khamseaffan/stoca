export type {
  Profile,
  Store,
  StoreType,
  GlobalProduct,
  StoreProduct,
  CartItem,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  Payment,
  Promotion,
  AIConversation,
} from './database'

import type { CartItem, StoreProduct, Order, OrderItem, Store, Profile } from './database'

export interface CartWithItems extends CartItem {
  store_product: StoreProduct
  store: Pick<Store, 'id' | 'name' | 'slug'>
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
  store: Pick<Store, 'id' | 'name' | 'slug' | 'phone'>
  profile?: Pick<Profile, 'first_name' | 'last_name' | 'email' | 'phone'>
}

export interface StoreWithProducts extends Store {
  store_products: StoreProduct[]
}

export interface DashboardStats {
  todayRevenue: number
  todayOrders: number
  lowStockCount: number
  pendingOrders: number
  avgOrderValue: number
  cancellationRate: number
  repeatCustomerPct: number
  avgFulfillmentMinutes: number
}

export interface RevenueTrendPoint {
  date: string
  revenue: number
  orders: number
  avgOrderValue: number
}

export interface TopProduct {
  name: string
  unitsSold: number
  revenue: number
}

export interface RecentOrder {
  id: string
  customerName: string
  total: number
  status: string
  createdAt: string
  itemCount: number
}

export interface LowStockProduct {
  name: string
  quantity: number
  threshold: number
}

export interface PeakHourCell {
  hour: number
  dayOfWeek: number
  count: number
}

export interface RevenueByType {
  type: string
  revenue: number
  count: number
}

export interface CategoryRevenue {
  category: string
  revenue: number
  count: number
}

export interface InventoryItem {
  name: string
  unitsSold: number
  currentStock: number
  category: string
}

export interface TopCustomer {
  name: string
  totalSpent: number
  orderCount: number
}

export interface PromotionSummary {
  title: string
  discountPercent: number | null
  discountAmount: number | null
  isActive: boolean
}

export interface AnalyticsData {
  revenueTrend: RevenueTrendPoint[]
  topProducts: TopProduct[]
  recentOrders: RecentOrder[]
  lowStockProducts: LowStockProduct[]
  peakHours: PeakHourCell[]
  revenueByType: RevenueByType[]
  categoryBreakdown: CategoryRevenue[]
  inventoryTurnover: InventoryItem[]
  topCustomers: TopCustomer[]
  promotions: PromotionSummary[]
}
