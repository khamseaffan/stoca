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
}
