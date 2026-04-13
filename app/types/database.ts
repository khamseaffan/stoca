export interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'CUSTOMER' | 'STORE_OWNER' | 'ADMIN'
  phone: string | null
  avatar_url: string | null
  preferred_language: string
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface Store {
  id: string
  owner_id: string
  name: string
  slug: string | null
  description: string | null
  street_address: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: string
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  store_type: StoreType
  logo_url: string | null
  banner_url: string | null
  is_active: boolean
  pickup_enabled: boolean
  delivery_enabled: boolean
  delivery_radius_km: number | null
  delivery_fee: number
  minimum_order: number
  operating_hours: Record<string, { open: string; close: string }> | Record<string, never>
  stripe_account_id: string | null
  created_at: string
  updated_at: string
}

export type StoreType =
  | 'GROCERY'
  | 'CONVENIENCE'
  | 'BAKERY'
  | 'BUTCHER'
  | 'PHARMACY'
  | 'HARDWARE'
  | 'SPECIALTY_FOOD'
  | 'ORGANIC'
  | 'DELI'
  | 'FLOWER'
  | 'PET'
  | 'ELECTRONICS'
  | 'OTHER'

export interface GlobalProduct {
  id: string
  name: string
  description: string | null
  category: string
  subcategory: string | null
  brand: string | null
  barcode: string | null
  image_urls: string[]
  attributes: Record<string, unknown>
  embedding: number[] | null
  created_at: string
  updated_at: string
}

export interface StoreProduct {
  id: string
  store_id: string
  global_product_id: string | null
  name: string
  description: string | null
  price: number
  compare_at_price: number | null
  category: string | null
  subcategory: string | null
  image_urls: string[]
  quantity: number
  low_stock_threshold: number
  is_available: boolean
  is_featured: boolean
  attributes: Record<string, unknown>
  embedding: number[] | null
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  user_id: string
  store_id: string
  store_product_id: string
  quantity: number
  captured_price: number
  created_at: string
  updated_at: string
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'

export type OrderType = 'PICKUP' | 'DELIVERY'

export interface Order {
  id: string
  user_id: string
  store_id: string
  status: OrderStatus
  order_type: OrderType
  subtotal: number
  tax: number
  delivery_fee: number
  total: number
  delivery_address: Record<string, string> | null
  customer_notes: string | null
  store_notes: string | null
  payment_intent_id: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  store_product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: string
}

export interface Payment {
  id: string
  order_id: string
  stripe_payment_intent_id: string | null
  amount: number
  currency: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Promotion {
  id: string
  store_id: string
  store_product_id: string | null
  title: string | null
  discount_percent: number | null
  discount_amount: number | null
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AIConversation {
  id: string
  store_id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: Record<string, unknown>
  tool_calls: Record<string, unknown> | null
  image_url: string | null
  created_at: string
}
