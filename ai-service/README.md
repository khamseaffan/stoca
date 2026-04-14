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
- `POST /api/tools/add-from-catalog` — add from global catalog
- `POST /api/tools/add-custom-product` — add custom product
- `POST /api/tools/remove-product` — soft delete
- `POST /api/tools/update-stock` — set quantity
- `POST /api/tools/low-stock-alerts` — below-threshold products

### Store Tools
- `POST /api/tools/update-store-hours` — operating hours
- `POST /api/tools/update-store-info` — name/description/phone
- `POST /api/tools/create-promotion` — create discount

### Order Tools
- `POST /api/tools/get-orders` — recent orders
- `POST /api/tools/get-order-details` — order + items
- `POST /api/tools/update-order-status` — change status

### Analytics
- `POST /api/tools/sales-summary` — revenue/count by period
- `POST /api/tools/top-products` — best sellers

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
