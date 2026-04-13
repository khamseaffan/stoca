# Stoca API Reference

## Next.js API Routes

### `POST /api/ai/chat`

Streaming AI chat endpoint. Authenticates the store owner, fetches live store context via Prisma (product count, pending orders, today's revenue, low stock), builds a dynamic system prompt, then calls Claude via `streamText()` with 16 tools. Each tool delegates execution to the Python AI service.

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

**Tools** (16 total, each defined with zod input schemas):

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

## Python Tool Endpoints (`AI_SERVICE_URL`)

All endpoints are called by the Next.js chat route on behalf of Claude's tool calls. They require:
- `Content-Type: application/json`
- `Authorization: Bearer <jwt>` — the store owner's Supabase JWT, forwarded from the chat route

The Python service validates the JWT and resolves `store_id` ownership before executing.

### Product Tools

#### `POST /api/tools/search-products`
```json
// Request
{ "store_id": "uuid", "query": "milk" }

// Response
{
  "products": [
    { "id": "uuid", "name": "Whole Milk", "price": 4.99, "quantity": 25, "category": "Dairy" },
    { "id": "uuid", "name": "2% Milk", "price": 4.49, "quantity": 18, "category": "Dairy" }
  ]
}
```

#### `POST /api/tools/update-price`
```json
// Request
{ "store_id": "uuid", "product_id": "uuid", "new_price": 5.49 }

// Response
{ "product_id": "uuid", "name": "Whole Milk", "old_price": 4.99, "new_price": 5.49 }
```

#### `POST /api/tools/add-from-catalog`
```json
// Request
{ "store_id": "uuid", "global_product_id": "uuid", "price": 3.99 }

// Response
{ "product_id": "uuid", "product_name": "Greek Yogurt", "price": 3.99 }
```

#### `POST /api/tools/add-custom-product`
```json
// Request
{ "store_id": "uuid", "name": "House Blend Coffee", "price": 12.99, "category": "Beverages", "description": "Our signature blend", "quantity": 30 }

// Response
{ "product_id": "uuid", "product_name": "House Blend Coffee", "price": 12.99 }
```

#### `POST /api/tools/remove-product`
```json
// Request
{ "store_id": "uuid", "product_id": "uuid" }

// Response
{ "success": true, "product_name": "Discontinued Item" }
```

#### `POST /api/tools/update-stock`
```json
// Request
{ "store_id": "uuid", "product_id": "uuid", "quantity": 50 }

// Response
{ "product_id": "uuid", "name": "Organic Eggs", "quantity": 50 }
```

#### `POST /api/tools/low-stock`
```json
// Request
{ "store_id": "uuid" }

// Response
{
  "alerts": [
    { "id": "uuid", "name": "Organic Eggs", "quantity": 2, "threshold": 5 },
    { "id": "uuid", "name": "Avocados", "quantity": 3, "threshold": 5 }
  ]
}
```

### Store Tools

#### `POST /api/tools/update-hours`
```json
// Request
{ "store_id": "uuid", "hours": { "monday": { "open": "08:00", "close": "21:00" }, "sunday": { "open": "10:00", "close": "18:00" } } }

// Response
{ "success": true, "message": "Store hours updated" }
```

#### `POST /api/tools/update-info`
```json
// Request
{ "store_id": "uuid", "description": "Brooklyn's freshest grocery store" }

// Response
{ "success": true, "message": "Store info updated" }
```

#### `POST /api/tools/create-promotion`
```json
// Request
{ "store_id": "uuid", "title": "Spring Sale", "discount_percent": 15, "product_id": "uuid" }

// Response
{ "promotion_id": "uuid", "title": "Spring Sale", "discount_percent": 15, "code": "SPRING15" }
```

### Order Tools

#### `POST /api/tools/recent-orders`
```json
// Request
{ "store_id": "uuid", "limit": 5 }

// Response
{
  "orders": [
    { "id": "uuid", "customer_name": "Emily Wilson", "total": 23.47, "status": "PENDING", "item_count": 3, "created_at": "2026-04-10T14:30:00Z" }
  ]
}
```

#### `POST /api/tools/order-details`
```json
// Request
{ "store_id": "uuid", "order_id": "uuid" }

// Response
{
  "id": "uuid",
  "customer": { "name": "Emily Wilson", "email": "emily@demo.com" },
  "status": "PENDING",
  "order_type": "PICKUP",
  "items": [
    { "product_name": "Whole Milk", "quantity": 2, "unit_price": 4.99, "total_price": 9.98 }
  ],
  "subtotal": 23.47,
  "total": 23.47
}
```

#### `POST /api/tools/update-order-status`
```json
// Request
{ "store_id": "uuid", "order_id": "uuid", "status": "CONFIRMED" }

// Response
{ "order_id": "uuid", "old_status": "PENDING", "status": "CONFIRMED" }
```

### Analytics Tools

#### `POST /api/tools/sales-summary`
```json
// Request
{ "store_id": "uuid", "period": "today" }

// Response
{ "period": "today", "total_revenue": 247.50, "order_count": 12, "average_order": 20.63 }
```

#### `POST /api/tools/top-products`
```json
// Request
{ "store_id": "uuid", "limit": 5 }

// Response
{
  "products": [
    { "name": "Sourdough Bread", "units_sold": 34, "revenue": 237.66 },
    { "name": "Whole Milk", "units_sold": 28, "revenue": 139.72 }
  ]
}
```

### Vision Tool

#### `POST /api/tools/scan-inventory`
```json
// Request
{ "store_id": "uuid", "image_url": "https://storage.supabase.co/.../shelf.jpg" }

// Response
{
  "products": [
    { "name": "Whole Milk", "confidence": 0.95, "category": "Dairy", "estimated_quantity": 12 },
    { "name": "Orange Juice", "confidence": 0.87, "category": "Beverages", "estimated_quantity": 8 }
  ]
}
```
