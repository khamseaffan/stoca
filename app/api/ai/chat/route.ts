import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
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

You can use tools to manage the store. Always confirm before destructive actions (removing products, cancelling orders). Be concise and helpful.`
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
 * context via Prisma, then streams a Claude response with 16 tools defined
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
            return callToolService('/api/tools/search-products', { store_id: storeId, query }, token)
          },
        }),

        update_product_price: tool({
          description: 'Update the price of a store product',
          inputSchema: z.object({
            product_id: z.string().describe('The store product ID'),
            new_price: z.number().positive().describe('The new price in dollars'),
          }),
          execute: async ({ product_id, new_price }) => {
            return callToolService('/api/tools/update-price', { store_id: storeId, product_id, new_price }, token)
          },
        }),

        add_product_from_catalog: tool({
          description: 'Add a product from the global catalog to this store',
          inputSchema: z.object({
            global_product_id: z.string().describe('The global product ID to add'),
            price: z.number().positive().describe('The price to set for this product'),
          }),
          execute: async ({ global_product_id, price }) => {
            return callToolService('/api/tools/add-from-catalog', { store_id: storeId, global_product_id, price }, token)
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
              store_id: storeId, name, price, category, description, quantity,
            }, token)
          },
        }),

        remove_product: tool({
          description: 'Remove a product from the store. Always confirm with the owner before removing.',
          inputSchema: z.object({
            product_id: z.string().describe('The store product ID to remove'),
          }),
          execute: async ({ product_id }) => {
            return callToolService('/api/tools/remove-product', { store_id: storeId, product_id }, token)
          },
        }),

        update_stock_quantity: tool({
          description: 'Update the stock quantity of a store product',
          inputSchema: z.object({
            product_id: z.string().describe('The store product ID'),
            quantity: z.number().int().nonnegative().describe('The new stock quantity'),
          }),
          execute: async ({ product_id, quantity }) => {
            return callToolService('/api/tools/update-stock', { store_id: storeId, product_id, quantity }, token)
          },
        }),

        get_low_stock_alerts: tool({
          description: 'Get a list of products that are low in stock',
          inputSchema: z.object({}),
          execute: async () => {
            return callToolService('/api/tools/low-stock', { store_id: storeId }, token)
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
            return callToolService('/api/tools/update-hours', { store_id: storeId, hours }, token)
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
            return callToolService('/api/tools/update-info', { store_id: storeId, name, description, phone }, token)
          },
        }),

        create_promotion: tool({
          description: 'Create a promotional discount for the store or a specific product',
          inputSchema: z.object({
            product_id: z.string().optional().describe('Specific product ID to apply promotion to (optional for store-wide)'),
            title: z.string().describe('Promotion title'),
            discount_percent: z.number().min(1).max(100).optional().describe('Discount percentage (1-100)'),
            discount_amount: z.number().positive().optional().describe('Fixed discount amount in dollars'),
          }),
          execute: async ({ product_id, title, discount_percent, discount_amount }) => {
            return callToolService('/api/tools/create-promotion', {
              store_id: storeId, product_id, title, discount_percent, discount_amount,
            }, token)
          },
        }),

        get_recent_orders: tool({
          description: 'Get the most recent orders for this store',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(50).default(10).describe('Number of orders to retrieve'),
          }),
          execute: async ({ limit }) => {
            return callToolService('/api/tools/recent-orders', { store_id: storeId, limit }, token)
          },
        }),

        get_order_details: tool({
          description: 'Get full details of a specific order including items',
          inputSchema: z.object({
            order_id: z.string().describe('The order ID to look up'),
          }),
          execute: async ({ order_id }) => {
            return callToolService('/api/tools/order-details', { store_id: storeId, order_id }, token)
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
            return callToolService('/api/tools/update-order-status', { store_id: storeId, order_id, status }, token)
          },
        }),

        get_sales_summary: tool({
          description: 'Get a sales summary for a given time period',
          inputSchema: z.object({
            period: z.enum(['today', 'week', 'month']).describe('Time period for the summary'),
          }),
          execute: async ({ period }) => {
            return callToolService('/api/tools/sales-summary', { store_id: storeId, period }, token)
          },
        }),

        get_top_products: tool({
          description: 'Get the top selling products for this store',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(20).default(5).describe('Number of top products to retrieve'),
          }),
          execute: async ({ limit }) => {
            return callToolService('/api/tools/top-products', { store_id: storeId, limit }, token)
          },
        }),

        process_inventory_image: tool({
          description: 'Process a photo of store shelves or inventory to identify products and quantities',
          inputSchema: z.object({
            image_url: z.string().url().describe('URL of the inventory image to process'),
          }),
          execute: async ({ image_url }) => {
            return callToolService('/api/tools/scan-inventory', { store_id: storeId, image_url }, token)
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
