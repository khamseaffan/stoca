# Stoca AI Tool Service

FastAPI backend that executes AI tool calls for the Stoca platform. This service does **not** call Claude for chat — Next.js handles that directly via Vercel AI SDK. When Claude calls a tool, Next.js forwards the request here.

**Exception**: Vision (`/api/tools/scan-inventory`) and enrichment (`/api/ai/enrich`) endpoints call Claude/OpenAI directly for image analysis and product description generation.

## Architecture

```
Browser → Next.js (streamText → Claude) → tool call → Next.js handler → THIS SERVICE → PostgreSQL
```

## Setup

```bash
cd ai-service

# Install dependencies
uv sync

# Copy and fill in environment variables
cp .env.example .env

# Run (requires Supabase running locally: supabase start)
uv run uvicorn app.main:app --reload --port 8090
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | For vision scanning and product enrichment |
| `OPENAI_API_KEY` | For embedding generation (text-embedding-3-small) |
| `DATABASE_URL` | PostgreSQL connection (asyncpg format) |
| `SUPABASE_URL` | Local Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For storage access |
| `SUPABASE_JWT_SECRET` | For JWT validation |
| `EMBEDDING_MODEL` | OpenAI embedding model (default: text-embedding-3-small) |

## Endpoints

All tool endpoints require `Authorization: Bearer <jwt>` and return `{"success": bool, "result": str}`.

### Health
- `GET /api/ai/health`

### Product Tools
- `POST /api/tools/search-products` — search by name
- `POST /api/tools/get-all-products` — paginated listing
- `POST /api/tools/update-price` — change price
- `POST /api/tools/update-product-details` — edit product metadata
- `POST /api/tools/add-from-catalog` — add from global catalog
- `POST /api/tools/add-custom-product` — add custom product
- `POST /api/tools/remove-product` — soft delete
- `POST /api/tools/set-product-availability` — publish/hide product
- `POST /api/tools/set-featured-product` — feature/unfeature product
- `POST /api/tools/update-stock` — set quantity
- `POST /api/tools/update-low-stock-threshold` — configure stock alert threshold
- `POST /api/tools/low-stock-alerts` — below-threshold products
- `POST /api/tools/inventory-summary` — inventory health and value
- `POST /api/tools/restock-recommendations` — reorder suggestions
- `POST /api/tools/bulk-update-stock` — update multiple quantities
- `POST /api/tools/mark-out-of-stock` — set product stock to zero
- `POST /api/tools/find-stale-inventory` — stocked products with no recent sales
- `POST /api/tools/inventory-value-by-category` — category inventory value
- `POST /api/tools/bulk-update-prices` — bulk price changes
- `POST /api/tools/find-products-missing-data` — missing listing data
- `POST /api/tools/duplicate-product-check` — likely duplicates
- `POST /api/tools/suggest-product-categories` — category cleanup suggestions
- `POST /api/tools/set-product-images-bulk` — fill missing images

### Store Tools
- `POST /api/tools/update-store-hours` — operating hours
- `POST /api/tools/update-store-info` — name/description/phone
- `POST /api/tools/update-delivery-settings` — pickup/delivery modes, radius, fee, minimum
- `POST /api/tools/update-store-address` — address/coordinates
- `POST /api/tools/set-store-active-status` — launch/pause storefront
- `POST /api/tools/update-store-branding` — logo/banner URLs

### Promotion Tools
- `POST /api/tools/create-promotion` — create discount
- `POST /api/tools/list-promotions` — active/scheduled/expired/inactive
- `POST /api/tools/get-promotion-details` — promotion details
- `POST /api/tools/update-promotion` — edit discount/target/dates/status
- `POST /api/tools/deactivate-promotion` — pause promotion
- `POST /api/tools/reactivate-promotion` — resume promotion
- `POST /api/tools/promotion-performance` — estimated sales performance

### Order Tools
- `POST /api/tools/get-orders` — recent orders
- `POST /api/tools/get-order-details` — order + items
- `POST /api/tools/update-order-status` — change status
- `POST /api/tools/list-orders-by-status` — filtered orders
- `POST /api/tools/find-delayed-orders` — old open orders
- `POST /api/tools/add-order-note` — append store note
- `POST /api/tools/get-customer-order-history` — customer orders
- `POST /api/tools/cancel-order` — cancel open order

### Analytics
- `POST /api/tools/sales-summary` — revenue/count by period
- `POST /api/tools/top-products` — best sellers
- `POST /api/tools/compare-sales-periods` — period comparison
- `POST /api/tools/category-sales-summary` — sales by category
- `POST /api/tools/slow-moving-products` — low velocity products
- `POST /api/tools/customer-summary` — customer summary
- `POST /api/tools/daily-business-brief` — daily operating brief

### AI Context
- `POST /api/tools/get-store-context` — store summary for system prompt

### Vision
- `POST /api/tools/scan-inventory` — Claude Vision image scan

### Search & Enrichment
- `POST /api/ai/search` — semantic product search (pgvector + text fallback)
- `POST /api/ai/enrich` — Claude-generated product descriptions

## Docker

```bash
docker build -t stoca-ai-service .
docker run -p 8090:8090 --env-file .env stoca-ai-service
```
