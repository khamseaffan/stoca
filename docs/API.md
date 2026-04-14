# Stoca API Reference

## Next.js API Routes

### `POST /api/ai/chat`

Streaming AI chat endpoint. Authenticates the store owner, fetches live store context via Prisma (product count, pending orders, today's revenue, low stock), builds a dynamic system prompt, then calls Claude via `streamText()` with 19 tools. Each tool delegates execution to the Python AI service.

**Auth**: Required — must be the owner of the specified store.

**Request Body**:
```json
{
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "parts": [{ "type": "text", "text": "What products are low on stock?" }]
    }
  ],
  "storeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response**: Server-sent event stream via `toUIMessageStreamResponse()`.

The stream emits `UIMessageChunk` objects that the frontend's `useChat` hook consumes. Text tokens stream in real-time. Tool calls appear as parts with `type: "tool-<name>"` and transition through states: `input-streaming` → `input-available` → `output-available`.

**Example streamed response** (simplified):
```
data: {"type":"text-start","id":"msg_2"}
data: {"type":"text-delta","textDelta":"Let me check "}
data: {"type":"text-delta","textDelta":"your low stock items..."}
data: {"type":"tool-call","toolCallId":"tc_1","toolName":"get_low_stock_alerts","args":{}}
data: {"type":"tool-result","toolCallId":"tc_1","result":"{\"alerts\":[{\"name\":\"Organic Eggs\",\"quantity\":2}]}"}
data: {"type":"text-delta","textDelta":"You have 1 product running low: **Organic Eggs** with only 2 left."}
data: {"type":"finish","finishReason":"stop"}
```

**Tools** (19 total, each defined with zod input schemas):

| Tool | Description | Input Schema |
|---|---|---|
| `search_store_products` | Search products by name/category | `{ query: string }` |
| `update_product_price` | Update a product's price | `{ product_id: string, new_price: number }` |
| `add_product_from_catalog` | Add a global catalog product to the store | `{ global_product_id: string, price: number }` |
| `add_custom_product` | Add a product not in the catalog | `{ name, price, category, description?, quantity }` |
| `remove_product` | Remove a product (confirms first) | `{ product_id: string }` |
| `update_stock_quantity` | Update stock count | `{ product_id: string, quantity: number }` |
| `get_low_stock_alerts` | List products below threshold | `{}` |
| `update_store_hours` | Update operating hours | `{ hours: Record<string, { open, close }> }` |
| `update_store_info` | Update store name/description/phone | `{ name?, description?, phone? }` |
| `create_promotion` | Create a discount promotion | `{ product_id?, title, discount_percent?, discount_amount? }` |
| `get_recent_orders` | Get latest orders | `{ limit: number }` |
| `get_order_details` | Get full order with items | `{ order_id: string }` |
| `update_order_status` | Change order status | `{ order_id: string, status: OrderStatus }` |
| `get_sales_summary` | Revenue/order stats | `{ period: 'today' \| 'week' \| 'month' }` |
| `get_top_products` | Best selling products | `{ limit: number }` |
| `process_inventory_image` | AI vision scan | `{ image_url: string }` |
| `search_product_image` | Find and set a product image from the web | `{ product_name: string, category?: string }` |
| `enrich_product_description` | Generate AI-written product description | `{ product_name: string }` |
| `enrich_products_bulk` | Bulk-enrich products (images or descriptions) | `{ filter: 'missing_images' \| 'missing_descriptions' \| 'all' }` |

**Tool parameter alignment note**: All Next.js tool schemas use parameter names that match the Python endpoint models exactly. Name-based lookups use `product_name` (not `product_id`). Catalog search uses `query` (not `global_product_id`). `store_id` is never sent in request bodies -- it is resolved from the JWT on the Python side.

**Error responses**:
- `400` — Missing `storeId`
- `401` — Not authenticated
- `403` — User doesn't own the specified store
- `500` — Claude or tool service failure

---

### `POST /api/ai/image`

Upload an image for AI-powered inventory scanning. Uploads to Supabase Storage, then forwards to the Python vision service.

**Auth**: Required — must be the owner of the specified store.

**Request Body**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | File | Yes | Image file (JPEG, PNG, WebP) |
| `storeId` | string | Yes | Store UUID |

**Example request** (curl):
```bash
curl -X POST http://localhost:3000/api/ai/image \
  -H "Cookie: sb-access-token=..." \
  -F "image=@shelf-photo.jpg" \
  -F "storeId=a1b2c3d4-..."
```

**Success response** (`200`):
```json
{
  "image_url": "http://127.0.0.1:54321/storage/v1/object/public/inventory-scans/store-id/1712345678-abc123.jpg",
  "scan_result": {
    "products": [
      { "name": "Whole Milk", "confidence": 0.95, "category": "Dairy" },
      { "name": "Greek Yogurt", "confidence": 0.88, "category": "Dairy" },
      { "name": "Cheddar Cheese", "confidence": 0.82, "category": "Dairy" }
    ]
  }
}
```

**Error responses**:
- `400` — Missing image or storeId
- `401` — Not authenticated
- `403` — User doesn't own the store
- `500` — Upload or scan failure

---

### `POST /api/ai/rewrite`

Generate a polished, AI-written product description using Claude. Forwards the request to the Python enrichment endpoint (`/api/ai/enrich`) and returns just the description string. Used by the `AIRewriteButton` component on product forms.

**Auth**: Required — Supabase session (access token forwarded to Python service).

**Request Body**:
```json
{
  "name": "Organic Sourdough Bread",
  "price": 6.99,
  "category": "Bakery"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Product name |
| `price` | number | No | Product price (improves description quality) |
| `category` | string | No | Product category (improves description quality) |

**Success response** (`200`):
```json
{
  "description": "Freshly baked organic sourdough with a crispy crust and tangy flavor. Perfect for sandwiches or as a side with any meal."
}
```

**Error responses**:
- `400` — Missing `name`
- `4xx` — Upstream Python service error (status forwarded)
- `500` — Internal server error

---

## Python Tool Endpoints (`AI_SERVICE_URL`)

All tool endpoints are called by the Next.js chat route on behalf of Claude's tool calls. They require:
- `Content-Type: application/json`
- `Authorization: Bearer <jwt>` — the store owner's Supabase JWT, forwarded from the chat route

The Python service validates the JWT and resolves store ownership before executing. `store_id` is **not** passed in the body — it's resolved from the JWT.

All tool endpoints return: `{"success": bool, "result": str}` (result is JSON-stringified for complex data).

### Product Tools

#### `POST /api/tools/search-products`
```json
// Request
{ "query": "milk" }

// Response
{ "success": true, "result": "[{\"id\": \"uuid\", \"name\": \"Whole Milk\", \"price\": 4.99, \"quantity\": 25, \"category\": \"Dairy\"}]" }
```

#### `POST /api/tools/get-all-products`
```json
// Request
{ "page": 1, "per_page": 20 }

// Response
{ "success": true, "result": "{\"products\": [...], \"total\": 42, \"page\": 1}" }
```

#### `POST /api/tools/update-price`
```json
// Request
{ "product_name": "Whole Milk", "new_price": 5.49 }

// Response — single match
{ "success": true, "result": "Updated Whole Milk: $4.99 → $5.49" }

// Response — multiple matches (Claude should disambiguate)
{ "success": false, "result": "Multiple matches: ['Whole Milk', '2% Milk']. Which one?" }
```

#### `POST /api/tools/add-from-catalog`
```json
// Request
{ "query": "Greek Yogurt", "price": 3.99 }

// Response
{ "success": true, "result": "Added Greek Yogurt to your store at $3.99." }
```

#### `POST /api/tools/add-custom-product`
```json
// Request
{ "name": "House Blend Coffee", "price": 12.99, "category": "Beverages", "description": "Our signature blend", "quantity": 30 }

// Response
{ "success": true, "result": "Added custom product 'House Blend Coffee' at $12.99 (qty: 30)." }
```

#### `POST /api/tools/remove-product`
```json
// Request
{ "product_name": "Discontinued Item" }

// Response
{ "success": true, "result": "Removed Discontinued Item from your store." }
```

#### `POST /api/tools/update-stock`
```json
// Request
{ "product_name": "Organic Eggs", "quantity": 50 }

// Response
{ "success": true, "result": "Updated Organic Eggs stock: 12 → 50" }
```

#### `POST /api/tools/low-stock-alerts`
```json
// Request — no body required

// Response
{ "success": true, "result": "[{\"id\": \"uuid\", \"name\": \"Organic Eggs\", \"quantity\": 2, \"threshold\": 5}]" }
```

### Store Tools

#### `POST /api/tools/update-store-hours`
```json
// Request
{ "hours": { "monday": { "open": "08:00", "close": "21:00" }, "sunday": { "open": "10:00", "close": "18:00" } } }

// Response
{ "success": true, "result": "Store hours updated." }
```

#### `POST /api/tools/update-store-info`
```json
// Request
{ "description": "Brooklyn's freshest grocery store" }

// Response
{ "success": true, "result": "Updated store: description." }
```

#### `POST /api/tools/create-promotion`
```json
// Request
{ "title": "Spring Sale", "discount_percent": 15, "product_name": "Sourdough Bread" }

// Response
{ "success": true, "result": "Created promotion 'Spring Sale': 15.0% off on Sourdough Bread." }
```

### Order Tools

#### `POST /api/tools/get-orders`
```json
// Request
{ "limit": 5 }

// Response
{ "success": true, "result": "[{\"id\": \"uuid\", \"customer_name\": \"Emily Wilson\", \"status\": \"PENDING\", \"total\": 23.47, \"item_count\": 3, \"created_at\": \"2026-04-10T14:30:00Z\"}]" }
```

#### `POST /api/tools/get-order-details`
```json
// Request
{ "order_id": "uuid" }

// Response
{ "success": true, "result": "{\"id\": \"uuid\", \"customer\": {\"name\": \"Emily Wilson\", \"email\": \"emily@demo.com\"}, \"status\": \"PENDING\", \"order_type\": \"PICKUP\", \"items\": [{\"product_name\": \"Whole Milk\", \"quantity\": 2, \"unit_price\": 4.99, \"total_price\": 9.98}], \"subtotal\": 23.47, \"total\": 23.47}" }
```

#### `POST /api/tools/update-order-status`
```json
// Request
{ "order_id": "uuid", "status": "CONFIRMED" }

// Response
{ "success": true, "result": "Order updated: PENDING → CONFIRMED" }
```

### Analytics Tools

#### `POST /api/tools/sales-summary`
```json
// Request
{ "period": "today" }

// Response
{ "success": true, "result": "{\"period\": \"today\", \"total_revenue\": 247.50, \"order_count\": 12, \"average_order\": 20.63}" }
```

#### `POST /api/tools/top-products`
```json
// Request
{ "limit": 5 }

// Response
{ "success": true, "result": "[{\"name\": \"Sourdough Bread\", \"units_sold\": 34, \"revenue\": 237.66}]" }
```

### Store Context

#### `POST /api/tools/get-store-context`
Used by Next.js to build the AI system prompt. No body required.
```json
// Response
{ "success": true, "result": "{\"store_name\": \"Brooklyn Grocers\", \"store_type\": \"GROCERY\", \"product_count\": 42, \"pending_orders\": 3, \"todays_revenue\": 247.50}" }
```

### Vision Tool

#### `POST /api/tools/scan-inventory`
```json
// Request
{ "image_url": "https://storage.supabase.co/.../shelf.jpg" }

// Response
{ "success": true, "result": "[{\"name\": \"Whole Milk\", \"brand\": \"Organic Valley\", \"estimated_quantity\": 12, \"confidence\": 0.95, \"matched_global_product_id\": \"uuid\"}]" }
```

### Enrichment Tools

#### `POST /api/tools/search-product-image`

Find and set a product image using the Pexels API. Falls back to a `placehold.co` placeholder if no Pexels API key is configured or the search returns no results. Looks up the product by name in the owner's store, then updates its `image_urls` column.

```json
// Request
{ "product_name": "Whole Milk", "category": "Dairy" }

// Response — image found and saved
{ "success": true, "result": "Found image for Whole Milk" }

// Response — product not found
{ "success": false, "result": "No product matching 'Almond Milk' found in your store." }

// Response — multiple matches
{ "success": false, "result": "Multiple matches for 'Milk': ['Whole Milk', '2% Milk', 'Oat Milk']. Please be more specific." }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `product_name` | string | Yes | Product name to search for |
| `category` | string | No | Category hint for better image search results |

#### `POST /api/tools/enrich-product-description`

Generate a compelling AI-written description for a single product using Claude. Looks up the product by name, calls the enrichment service, then saves the generated description to the database.

```json
// Request
{ "product_name": "Whole Milk" }

// Response
{ "success": true, "result": "Updated description for Whole Milk: Farm-fresh whole milk with a rich, creamy taste. A versatile kitchen staple for cooking, baking, and enjoying by the glass." }

// Response — product not found
{ "success": false, "result": "No product matching 'Almond Butter' found in your store." }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `product_name` | string | Yes | Product name to generate a description for |

#### `POST /api/tools/enrich-products-bulk`

Bulk-enrich multiple products at once. Finds products that are missing images or descriptions and fills them in automatically. Images come from Pexels (with placeholder fallback). Descriptions come from Claude.

Rate-limited to a maximum of 20 products per call to avoid timeouts.

```json
// Request — find images for all products missing them
{ "filter": "missing_images" }

// Response
{ "success": true, "result": "Enriched 12 products with images" }

// Request — generate descriptions for products without one
{ "filter": "missing_descriptions" }

// Response
{ "success": true, "result": "Enriched 8 products with descriptions" }

// Request — enrich everything missing
{ "filter": "all" }

// Response
{ "success": true, "result": "Enriched 12 products with images\nEnriched 8 products with descriptions" }

// Response — nothing to do
{ "success": true, "result": "All products already have images." }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `filter` | string | No (default: `"all"`) | One of `"missing_images"`, `"missing_descriptions"`, or `"all"` |

### Semantic Search

#### `POST /api/ai/search`
```json
// Request
{ "query": "organic dairy", "store_id": "uuid", "limit": 10 }

// Response (list of SearchResult)
[{ "product_id": "uuid", "store_id": "uuid", "store_name": "Brooklyn Grocers", "product_name": "Organic Whole Milk", "price": 5.99, "image_url": "https://...", "score": 0.92 }]
```

### Product Enrichment

#### `POST /api/ai/enrich`
```json
// Request
{ "name": "Organic Sourdough Bread", "price": 6.99, "category": "Bakery" }

// Response
{ "description": "Freshly baked organic sourdough with a crispy crust and tangy flavor. Perfect for sandwiches or as a side with any meal.", "category": "Bakery", "subcategory": "Bread", "tags": ["organic", "sourdough", "artisan", "bread"] }
```
