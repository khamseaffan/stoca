# AIsle

**The AI store manager that replaces an entire team.**

AIsle is an AI-native local commerce platform. One store owner, zero tech skills needed — manage everything through conversation.

## What It Does

- **Store owners** go online in 5 minutes. Set up a store, pick products from a global catalog, start taking orders. The AI assistant handles pricing, inventory, orders, and promotions.
- **Customers** browse local stores, order for pickup or delivery, and track orders in real-time.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TailwindCSS 4 + TypeScript
- **AI**: Vercel AI SDK + Anthropic Claude (streaming chat with tool-calling)
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime)
- **Tool Service**: Python / FastAPI (vision processing, semantic search, catalog enrichment)
- **Payments**: Stripe (PaymentIntents + Connect)
- **Analytics**: PostHog

## Development

```bash
# Prerequisites: Node.js 20+, Python 3.12+, Supabase CLI

# Start Supabase locally
supabase start
supabase db push

# Start Next.js
npm install
npm run dev

# Start AI tool service
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

## License

Proprietary. All rights reserved.
