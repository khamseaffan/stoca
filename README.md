# Stoca

**The AI store manager that replaces an entire team.**

Stoca is an AI-native local commerce platform. One store owner, zero tech skills needed — manage everything through conversation.

## What It Does

- **Store owners** go online in 5 minutes. Set up a store, pick products from a global catalog, start taking orders. The AI assistant handles pricing, inventory, orders, and promotions.
- **Customers** browse local stores, order for pickup or delivery, and track orders in real-time.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TailwindCSS 4.2 + TypeScript 5.8
- **AI**: Vercel AI SDK v6 + Anthropic Claude (streaming chat with 16 tools)
- **ORM**: Prisma 7 (pure TS, PrismaPg adapter) for type-safe database access
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime)
- **Tool Service**: Python 3.12 / FastAPI (vision, semantic search, catalog enrichment)
- **Analytics**: PostHog

## Development

### Prerequisites

- Node.js 20+
- Python 3.12+
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Environment Setup

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL (default: `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `DATABASE_URL` | Direct PostgreSQL connection for Prisma (default: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`) |
| `AI_SERVICE_URL` | Python tool service URL (default: `http://localhost:8090`) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL |

### Start Services

```bash
# 1. Start Supabase locally
supabase start

# 2. Install dependencies and generate Prisma client
npm install              # postinstall runs prisma generate automatically

# 3. Seed the database (optional — adds sample stores, products, orders)
supabase db reset        # runs migrations + seed.sql

# 4. Start Next.js dev server
npm run dev

# 5. Start AI tool service (separate terminal)
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

### Prisma Commands

```bash
npm run db:pull          # Introspect Supabase DB → update schema.prisma
npm run db:generate      # Regenerate typed client from schema
npm run db:push          # Push schema changes to DB
```

### Demo Accounts (from seed data)

| Email | Password | Role |
|---|---|---|
| `sarah@demo.com` | `password123` | Store Owner (Fresh Market) |
| `marcus@demo.com` | `password123` | Store Owner (Golden Crust Bakery) |
| `emily@demo.com` | `password123` | Customer |

## Documentation

- [API Reference](docs/API.md) — all Next.js and Python endpoints
- [Architecture](docs/ARCHITECTURE.md) — streaming chat flow, auth, data access patterns
- [Components](docs/COMPONENTS.md) — key component props and usage

## License

Proprietary. All rights reserved.
