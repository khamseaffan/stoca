import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8090'

/**
 * Fetches live store context for the AI system prompt.
 * Runs 5 parallel Prisma queries: store info, product count, pending orders,
 * today's revenue, and low stock items. Results are formatted into a summary
 * that gives Claude awareness of the store's current state.
 */
async function getStoreContext(storeId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [store, productCount, pendingOrders, todayOrders, lowStockItems] = await Promise.all([
    prisma.stores.findUnique({ where: { id: storeId }, select: { name: true, store_type: true } }),
    prisma.store_products.count({ where: { store_id: storeId, is_available: true } }),
    prisma.orders.count({ where: { store_id: storeId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } } }),
    prisma.orders.findMany({ where: { store_id: storeId, created_at: { gte: today } }, select: { total: true } }),
    prisma.store_products.findMany({ where: { store_id: storeId, is_available: true, quantity: { lte: 5 } }, select: { name: true, quantity: true } }),
  ])

  const revenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0)
  const lowStock = lowStockItems.map(p => `${p.name} (${p.quantity} left)`).join(', ') || 'None'

  return {
    storeName: store?.name ?? 'Unknown Store',
    storeType: store?.store_type ?? 'OTHER',
    productCount,
    pendingOrders,
    revenue: revenue.toFixed(2),
    lowStockItems: lowStock,
  }
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof getStoreContext>>) {
  return `You are the AI assistant for "${ctx.storeName}", a ${ctx.storeType} store. You help the store owner manage their business through conversation.

Current store context:
- Store: ${ctx.storeName} (${ctx.storeType})
- Products: ${ctx.productCount} active products
- Pending orders: ${ctx.pendingOrders}
- Today's revenue: $${ctx.revenue}
- Low stock items: ${ctx.lowStockItems}

You can use tools to manage the store. Always confirm before destructive actions (removing products, hiding products, cancelling orders, pausing the storefront, or deactivating promotions). Be concise and helpful.`
}

/**
 * Forwards a tool call to the Python AI service.
 * Sends the store owner's JWT for auth and returns the response as a JSON string.
 * On failure, returns a human-readable error string (not thrown) so Claude
 * can relay the error to the user conversationally.
 */
async function callToolService(
  endpoint: string,
  body: Record<string, unknown>,
  token: string
): Promise<string> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return `Error: ${response.status} - ${errorText}`
    }

    const data = await response.json()
    return JSON.stringify(data)
  } catch (error) {
    return `Error: Failed to reach AI service - ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * POST /api/ai/chat — Streaming AI chat endpoint.
 *
 * Expects JSON body: { messages: UIMessage[], storeId: string }
 * Authenticates the caller, verifies store ownership, fetches live store
 * context via Prisma, then streams a Claude response with 55 tools defined
 * inline. Each tool delegates execution to the Python AI service.
 *
 * Returns a UI message stream via `toUIMessageStreamResponse()`.
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, storeId } = await request.json()

    if (!storeId) {
      return new Response('Missing storeId', { status: 400 })
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (!rateLimit(`chat:${user.id}`, 20, 60_000)) {
      return new Response('Too many requests', { status: 429 })
    }

    // Verify the user owns this store
    const store = await prisma.stores.findFirst({
      where: { id: storeId, owner_id: user.id },
      select: { id: true },
    })

    if (!store) {
      return new Response('Store not found or access denied', { status: 403 })
    }

    // Get the session token for forwarding to the Python service
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const storeContext = await getStoreContext(storeId)

    const result = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: buildSystemPrompt(storeContext),
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(10),
      tools: {
        search_store_products: tool({
          description: 'Search for products in the store by name, category, or description',
          inputSchema: z.object({
            query: z.string().describe('Search query for products'),
          }),
          execute: async ({ query }) => {
            return callToolService('/api/tools/search-products', { query }, token)
          },
        }),

        list_store_products: tool({
          description: 'List store products with pagination. Use when the owner asks to see products, catalog, inventory list, or all items.',
          inputSchema: z.object({
            page: z.number().int().min(1).default(1).describe('Page number to retrieve'),
            per_page: z.number().int().min(1).max(100).default(20).describe('Number of products per page'),
          }),
          execute: async ({ page, per_page }) => {
            return callToolService('/api/tools/get-all-products', { page, per_page }, token)
          },
        }),

        update_product_price: tool({
          description: 'Update the price of a store product by name',
          inputSchema: z.object({
            product_name: z.string().describe('The product name (or partial name) to update'),
            new_price: z.number().positive().describe('The new price in dollars'),
          }),
          execute: async ({ product_name, new_price }) => {
            return callToolService('/api/tools/update-price', { product_name, new_price }, token)
          },
        }),

        update_product_details: tool({
          description: 'Update editable product details like name, description, category, subcategory, or compare-at price',
          inputSchema: z.object({
            product_name: z.string().describe('The current product name (or partial name) to update'),
            new_name: z.string().optional().describe('New product name'),
            description: z.string().optional().describe('New product description'),
            category: z.string().optional().describe('New product category'),
            subcategory: z.string().optional().describe('New product subcategory'),
            compare_at_price: z.number().positive().optional().describe('Optional original/list price for showing markdowns'),
          }),
          execute: async ({ product_name, new_name, description, category, subcategory, compare_at_price }) => {
            return callToolService('/api/tools/update-product-details', {
              product_name, new_name, description, category, subcategory, compare_at_price,
            }, token)
          },
        }),

        add_product_from_catalog: tool({
          description: 'Search the global catalog by name and add a matching product to this store',
          inputSchema: z.object({
            query: z.string().describe('Product name to search for in the global catalog'),
            price: z.number().positive().describe('The price to set for this product'),
          }),
          execute: async ({ query, price }) => {
            return callToolService('/api/tools/add-from-catalog', { query, price }, token)
          },
        }),

        add_custom_product: tool({
          description: 'Add a custom product that is not in the global catalog',
          inputSchema: z.object({
            name: z.string().describe('Product name'),
            price: z.number().positive().describe('Product price in dollars'),
            category: z.string().describe('Product category'),
            description: z.string().optional().describe('Product description'),
            quantity: z.number().int().nonnegative().describe('Initial stock quantity'),
          }),
          execute: async ({ name, price, category, description, quantity }) => {
            return callToolService('/api/tools/add-custom-product', {
              name, price, category, description, quantity,
            }, token)
          },
        }),

        remove_product: tool({
          description: 'Remove a product from the store by name. Always confirm with the owner before removing.',
          inputSchema: z.object({
            product_name: z.string().describe('The product name (or partial name) to remove'),
          }),
          execute: async ({ product_name }) => {
            return callToolService('/api/tools/remove-product', { product_name }, token)
          },
        }),

        set_product_availability: tool({
          description: 'Publish or hide a product from customers by name. Always confirm with the owner before hiding a product.',
          inputSchema: z.object({
            product_name: z.string().describe('The product name (or partial name) to publish or hide'),
            is_available: z.boolean().describe('true to publish/show the product, false to hide it from customers'),
          }),
          execute: async ({ product_name, is_available }) => {
            return callToolService('/api/tools/set-product-availability', { product_name, is_available }, token)
          },
        }),

        set_featured_product: tool({
          description: 'Feature or unfeature a product on the storefront by name',
          inputSchema: z.object({
            product_name: z.string().describe('The product name (or partial name) to feature or unfeature'),
            is_featured: z.boolean().describe('true to feature the product, false to unfeature it'),
          }),
          execute: async ({ product_name, is_featured }) => {
            return callToolService('/api/tools/set-featured-product', { product_name, is_featured }, token)
          },
        }),

        update_stock_quantity: tool({
          description: 'Update the stock quantity of a store product by name',
          inputSchema: z.object({
            product_name: z.string().describe('The product name (or partial name) to update'),
            quantity: z.number().int().nonnegative().describe('The new stock quantity'),
          }),
          execute: async ({ product_name, quantity }) => {
            return callToolService('/api/tools/update-stock', { product_name, quantity }, token)
          },
        }),

        update_low_stock_threshold: tool({
          description: 'Update the low-stock alert threshold for a store product by name',
          inputSchema: z.object({
            product_name: z.string().describe('The product name (or partial name) to update'),
            threshold: z.number().int().nonnegative().describe('The stock level below which this product is considered low stock'),
          }),
          execute: async ({ product_name, threshold }) => {
            return callToolService('/api/tools/update-low-stock-threshold', { product_name, threshold }, token)
          },
        }),

        get_low_stock_alerts: tool({
          description: 'Get a list of products that are low in stock',
          inputSchema: z.object({}),
          execute: async () => {
            return callToolService('/api/tools/low-stock-alerts', {}, token)
          },
        }),

        get_inventory_summary: tool({
          description: 'Get inventory health, total units, retail inventory value, low-stock count, out-of-stock count, and category breakdowns',
          inputSchema: z.object({}),
          execute: async () => {
            return callToolService('/api/tools/inventory-summary', {}, token)
          },
        }),

        get_restock_recommendations: tool({
          description: 'Recommend products to restock based on current stock and recent sales',
          inputSchema: z.object({
            days: z.number().int().min(1).max(365).default(30).describe('Sales lookback window in days'),
            limit: z.number().int().min(1).max(50).default(20).describe('Maximum recommendations to return'),
          }),
          execute: async ({ days, limit }) => {
            return callToolService('/api/tools/restock-recommendations', { days, limit }, token)
          },
        }),

        bulk_update_stock: tool({
          description: 'Update stock quantities for multiple products in one call',
          inputSchema: z.object({
            updates: z.array(z.object({
              product_name: z.string().describe('Product name or partial name'),
              quantity: z.number().int().nonnegative().describe('New stock quantity'),
            })).min(1).max(50),
          }),
          execute: async ({ updates }) => {
            return callToolService('/api/tools/bulk-update-stock', { updates }, token)
          },
        }),

        mark_out_of_stock: tool({
          description: 'Set a product quantity to zero, optionally hiding it from customers. Confirm before hiding.',
          inputSchema: z.object({
            product_name: z.string().describe('Product name or partial name'),
            hide_product: z.boolean().default(false).describe('Whether to hide the product from customers too'),
          }),
          execute: async ({ product_name, hide_product }) => {
            return callToolService('/api/tools/mark-out-of-stock', { product_name, hide_product }, token)
          },
        }),

        find_stale_inventory: tool({
          description: 'Find stocked products that have had no sales in a recent time window',
          inputSchema: z.object({
            days: z.number().int().min(1).max(365).default(30),
            limit: z.number().int().min(1).max(50).default(20),
          }),
          execute: async ({ days, limit }) => {
            return callToolService('/api/tools/find-stale-inventory', { days, limit }, token)
          },
        }),

        get_inventory_value_by_category: tool({
          description: 'Get inventory units and retail value grouped by category',
          inputSchema: z.object({}),
          execute: async () => {
            return callToolService('/api/tools/inventory-value-by-category', {}, token)
          },
        }),

        bulk_update_prices: tool({
          description: 'Bulk update product prices by product names or category. Use exactly one pricing mode.',
          inputSchema: z.object({
            product_names: z.array(z.string()).optional().describe('Specific product names to update'),
            category: z.string().optional().describe('Category to update'),
            percent_change: z.number().optional().describe('Percent change, e.g. 10 for +10% or -5 for -5%'),
            fixed_change: z.number().optional().describe('Fixed dollar change, e.g. 1.5 or -0.5'),
            set_price: z.number().positive().optional().describe('Set all matched products to this exact price'),
          }),
          execute: async ({ product_names, category, percent_change, fixed_change, set_price }) => {
            return callToolService('/api/tools/bulk-update-prices', {
              product_names, category, percent_change, fixed_change, set_price,
            }, token)
          },
        }),

        find_products_missing_data: tool({
          description: 'Find products missing images, descriptions, categories, or with price anomalies',
          inputSchema: z.object({
            filter: z.enum(['missing_images', 'missing_descriptions', 'missing_categories', 'price_anomalies', 'all']).default('all'),
          }),
          execute: async ({ filter }) => {
            return callToolService('/api/tools/find-products-missing-data', { filter }, token)
          },
        }),

        duplicate_product_check: tool({
          description: 'Find likely duplicate products in the store catalog',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(100).default(50),
          }),
          execute: async ({ limit }) => {
            return callToolService('/api/tools/duplicate-product-check', { limit }, token)
          },
        }),

        suggest_product_categories: tool({
          description: 'Suggest category cleanup for products based on product names',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(200).default(50),
          }),
          execute: async ({ limit }) => {
            return callToolService('/api/tools/suggest-product-categories', { limit }, token)
          },
        }),

        set_product_images_bulk: tool({
          description: 'Set placeholder images for products missing images in batches',
          inputSchema: z.object({
            filter: z.enum(['missing_images']).default('missing_images'),
            limit: z.number().int().min(1).max(50).default(20),
          }),
          execute: async ({ filter, limit }) => {
            return callToolService('/api/tools/set-product-images-bulk', { filter, limit }, token)
          },
        }),

        update_store_hours: tool({
          description: 'Update the store operating hours',
          inputSchema: z.object({
            hours: z.record(z.string(), z.object({
              open: z.string().describe('Opening time (e.g., "08:00")'),
              close: z.string().describe('Closing time (e.g., "21:00")'),
            })).describe('Operating hours by day of week'),
          }),
          execute: async ({ hours }) => {
            return callToolService('/api/tools/update-store-hours', { hours }, token)
          },
        }),

        update_store_info: tool({
          description: 'Update store information like name, description, or phone number',
          inputSchema: z.object({
            name: z.string().optional().describe('New store name'),
            description: z.string().optional().describe('New store description'),
            phone: z.string().optional().describe('New phone number'),
          }),
          execute: async ({ name, description, phone }) => {
            return callToolService('/api/tools/update-store-info', { name, description, phone }, token)
          },
        }),

        update_delivery_settings: tool({
          description: 'Update pickup/delivery modes, delivery radius, fee, and minimum order',
          inputSchema: z.object({
            pickup_enabled: z.boolean().optional(),
            delivery_enabled: z.boolean().optional(),
            delivery_radius_km: z.number().nonnegative().optional(),
            delivery_fee: z.number().nonnegative().optional(),
            minimum_order: z.number().nonnegative().optional(),
          }),
          execute: async ({ pickup_enabled, delivery_enabled, delivery_radius_km, delivery_fee, minimum_order }) => {
            return callToolService('/api/tools/update-delivery-settings', {
              pickup_enabled, delivery_enabled, delivery_radius_km, delivery_fee, minimum_order,
            }, token)
          },
        }),

        update_store_address: tool({
          description: 'Update store address or coordinates',
          inputSchema: z.object({
            street_address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            zipcode: z.string().optional(),
            country: z.string().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
          }),
          execute: async ({ street_address, city, state, zipcode, country, latitude, longitude }) => {
            return callToolService('/api/tools/update-store-address', {
              street_address, city, state, zipcode, country, latitude, longitude,
            }, token)
          },
        }),

        set_store_active_status: tool({
          description: 'Launch or pause the storefront. Always confirm before pausing the storefront.',
          inputSchema: z.object({
            is_active: z.boolean().describe('true to make storefront active, false to pause it'),
          }),
          execute: async ({ is_active }) => {
            return callToolService('/api/tools/set-store-active-status', { is_active }, token)
          },
        }),

        update_store_branding: tool({
          description: 'Update store logo or banner image URLs',
          inputSchema: z.object({
            logo_url: z.string().url().optional(),
            banner_url: z.string().url().optional(),
          }),
          execute: async ({ logo_url, banner_url }) => {
            return callToolService('/api/tools/update-store-branding', { logo_url, banner_url }, token)
          },
        }),

        create_promotion: tool({
          description: 'Create a promotional discount for the store or a specific product',
          inputSchema: z.object({
            product_name: z.string().optional().describe('Product name to apply promotion to (optional for store-wide)'),
            title: z.string().describe('Promotion title'),
            discount_percent: z.number().min(1).max(100).optional().describe('Discount percentage (1-100)'),
            discount_amount: z.number().positive().optional().describe('Fixed discount amount in dollars'),
            start_date: z.string().datetime().optional().describe('ISO start date/time'),
            end_date: z.string().datetime().optional().describe('ISO end date/time'),
          }),
          execute: async ({ product_name, title, discount_percent, discount_amount, start_date, end_date }) => {
            return callToolService('/api/tools/create-promotion', {
              product_name, title, discount_percent, discount_amount, start_date, end_date,
            }, token)
          },
        }),

        list_promotions: tool({
          description: 'List promotions by status: active, scheduled, expired, inactive, or all',
          inputSchema: z.object({
            status: z.enum(['active', 'scheduled', 'expired', 'inactive', 'all']).default('active'),
            limit: z.number().int().min(1).max(100).default(20),
          }),
          execute: async ({ status, limit }) => {
            return callToolService('/api/tools/list-promotions', { status, limit }, token)
          },
        }),

        get_promotion_details: tool({
          description: 'Get one promotion by id or title',
          inputSchema: z.object({
            promotion_id: z.string().optional(),
            title: z.string().optional(),
          }),
          execute: async ({ promotion_id, title }) => {
            return callToolService('/api/tools/get-promotion-details', { promotion_id, title }, token)
          },
        }),

        update_promotion: tool({
          description: 'Update promotion title, discount, product target, dates, or active state',
          inputSchema: z.object({
            promotion_id: z.string().optional(),
            title: z.string().optional().describe('Existing promotion title to find'),
            title_new: z.string().optional().describe('New promotion title'),
            product_name: z.string().optional().describe('Product to target'),
            apply_store_wide: z.boolean().default(false).describe('Set promotion to store-wide'),
            discount_percent: z.number().min(1).max(100).optional(),
            discount_amount: z.number().positive().optional(),
            start_date: z.string().datetime().optional(),
            end_date: z.string().datetime().optional(),
            is_active: z.boolean().optional(),
          }),
          execute: async ({
            promotion_id, title, title_new, product_name, apply_store_wide,
            discount_percent, discount_amount, start_date, end_date, is_active,
          }) => {
            return callToolService('/api/tools/update-promotion', {
              promotion_id, title, title_new, product_name, apply_store_wide,
              discount_percent, discount_amount, start_date, end_date, is_active,
            }, token)
          },
        }),

        deactivate_promotion: tool({
          description: 'Deactivate a promotion. Always confirm before deactivating.',
          inputSchema: z.object({
            promotion_id: z.string().optional(),
            title: z.string().optional(),
          }),
          execute: async ({ promotion_id, title }) => {
            return callToolService('/api/tools/deactivate-promotion', { promotion_id, title }, token)
          },
        }),

        reactivate_promotion: tool({
          description: 'Reactivate an inactive promotion',
          inputSchema: z.object({
            promotion_id: z.string().optional(),
            title: z.string().optional(),
          }),
          execute: async ({ promotion_id, title }) => {
            return callToolService('/api/tools/reactivate-promotion', { promotion_id, title }, token)
          },
        }),

        get_promotion_performance: tool({
          description: 'Estimate promotion performance from matching order sales during its active window',
          inputSchema: z.object({
            promotion_id: z.string().optional(),
            title: z.string().optional(),
          }),
          execute: async ({ promotion_id, title }) => {
            return callToolService('/api/tools/promotion-performance', { promotion_id, title }, token)
          },
        }),

        get_recent_orders: tool({
          description: 'Get the most recent orders for this store',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(50).default(10).describe('Number of orders to retrieve'),
          }),
          execute: async ({ limit }) => {
            return callToolService('/api/tools/get-orders', { limit }, token)
          },
        }),

        get_order_details: tool({
          description: 'Get full details of a specific order including items',
          inputSchema: z.object({
            order_id: z.string().describe('The order ID to look up'),
          }),
          execute: async ({ order_id }) => {
            return callToolService('/api/tools/get-order-details', { order_id }, token)
          },
        }),

        update_order_status: tool({
          description: 'Update the status of an order. Always confirm before cancelling.',
          inputSchema: z.object({
            order_id: z.string().describe('The order ID to update'),
            status: z.enum([
              'PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
              'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED',
            ]).describe('The new order status'),
          }),
          execute: async ({ order_id, status }) => {
            return callToolService('/api/tools/update-order-status', { order_id, status }, token)
          },
        }),

        list_orders_by_status: tool({
          description: 'List orders by status',
          inputSchema: z.object({
            status: z.enum([
              'PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP',
              'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED',
            ]),
            limit: z.number().int().min(1).max(100).default(20),
          }),
          execute: async ({ status, limit }) => {
            return callToolService('/api/tools/list-orders-by-status', { status, limit }, token)
          },
        }),

        find_delayed_orders: tool({
          description: 'Find open orders that have been waiting longer than a threshold',
          inputSchema: z.object({
            older_than_minutes: z.number().int().min(1).max(10080).default(60),
            limit: z.number().int().min(1).max(100).default(20),
          }),
          execute: async ({ older_than_minutes, limit }) => {
            return callToolService('/api/tools/find-delayed-orders', { older_than_minutes, limit }, token)
          },
        }),

        add_order_note: tool({
          description: 'Append an internal store note to an order',
          inputSchema: z.object({
            order_id: z.string(),
            note: z.string(),
          }),
          execute: async ({ order_id, note }) => {
            return callToolService('/api/tools/add-order-note', { order_id, note }, token)
          },
        }),

        get_customer_order_history: tool({
          description: 'Get order history for a customer by email or name',
          inputSchema: z.object({
            customer_email: z.string().optional(),
            customer_name: z.string().optional(),
            limit: z.number().int().min(1).max(100).default(20),
          }),
          execute: async ({ customer_email, customer_name, limit }) => {
            return callToolService('/api/tools/get-customer-order-history', { customer_email, customer_name, limit }, token)
          },
        }),

        cancel_order: tool({
          description: 'Cancel an open order. This does not issue payment refunds. Always confirm first.',
          inputSchema: z.object({
            order_id: z.string(),
          }),
          execute: async ({ order_id }) => {
            return callToolService('/api/tools/cancel-order', { order_id }, token)
          },
        }),

        get_sales_summary: tool({
          description: 'Get a sales summary for a given time period',
          inputSchema: z.object({
            period: z.enum(['today', 'week', 'month']).describe('Time period for the summary'),
          }),
          execute: async ({ period }) => {
            return callToolService('/api/tools/sales-summary', { period }, token)
          },
        }),

        get_top_products: tool({
          description: 'Get the top selling products for this store',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(20).default(5).describe('Number of top products to retrieve'),
          }),
          execute: async ({ limit }) => {
            return callToolService('/api/tools/top-products', { limit }, token)
          },
        }),

        compare_sales_periods: tool({
          description: 'Compare sales for a period against the previous equivalent period',
          inputSchema: z.object({
            period: z.enum(['today', 'week', 'month']).default('week'),
          }),
          execute: async ({ period }) => {
            return callToolService('/api/tools/compare-sales-periods', { period }, token)
          },
        }),

        get_category_sales_summary: tool({
          description: 'Get revenue and units sold by product category',
          inputSchema: z.object({
            period: z.enum(['today', 'week', 'month']).default('month'),
            limit: z.number().int().min(1).max(50).default(20),
          }),
          execute: async ({ period, limit }) => {
            return callToolService('/api/tools/category-sales-summary', { period, limit }, token)
          },
        }),

        get_slow_moving_products: tool({
          description: 'Find stocked products with the lowest recent sales velocity',
          inputSchema: z.object({
            days: z.number().int().min(1).max(365).default(30),
            limit: z.number().int().min(1).max(50).default(20),
          }),
          execute: async ({ days, limit }) => {
            return callToolService('/api/tools/slow-moving-products', { days, limit }, token)
          },
        }),

        get_customer_summary: tool({
          description: 'Summarize new/repeat customers and top customers for a period',
          inputSchema: z.object({
            period: z.enum(['today', 'week', 'month']).default('month'),
            limit: z.number().int().min(1).max(50).default(10),
          }),
          execute: async ({ period, limit }) => {
            return callToolService('/api/tools/customer-summary', { period, limit }, token)
          },
        }),

        get_daily_business_brief: tool({
          description: 'Get a compact daily brief: revenue, orders, open orders, low stock, and active promotions',
          inputSchema: z.object({}),
          execute: async () => {
            return callToolService('/api/tools/daily-business-brief', {}, token)
          },
        }),

        process_inventory_image: tool({
          description: 'Process a photo of store shelves or inventory to identify products and quantities',
          inputSchema: z.object({
            image_url: z.string().url().describe('URL of the inventory image to process'),
          }),
          execute: async ({ image_url }) => {
            return callToolService('/api/tools/scan-inventory', { image_url }, token)
          },
        }),

        search_product_image: tool({
          description: 'Find and set a product image from the web. Use when products are missing images.',
          inputSchema: z.object({
            product_name: z.string().describe('The product name to find an image for'),
            category: z.string().optional().describe('Optional category hint for better image results'),
          }),
          execute: async ({ product_name, category }) => {
            return callToolService('/api/tools/search-product-image', { product_name, category }, token)
          },
        }),

        enrich_product_description: tool({
          description: 'Generate a compelling AI-written description for a product',
          inputSchema: z.object({
            product_name: z.string().describe('The product name to generate a description for'),
          }),
          execute: async ({ product_name }) => {
            return callToolService('/api/tools/enrich-product-description', { product_name }, token)
          },
        }),

        enrich_products_bulk: tool({
          description: 'Bulk-enrich multiple products at once — find missing images or generate missing descriptions',
          inputSchema: z.object({
            filter: z.enum(['missing_images', 'missing_descriptions', 'all']).describe('Which products to enrich'),
          }),
          execute: async ({ filter }) => {
            return callToolService('/api/tools/enrich-products-bulk', { filter }, token)
          },
        }),
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('AI Chat Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
