import { Search as SearchIcon, Store, Package } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { StoreCard } from '@/components/commerce/StoreCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { StoreProduct, StoreType } from '@/types'
import { SearchProducts } from './SearchProducts'

interface SearchPageProps {
  searchParams: Promise<{ q?: string; category?: string }>
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  return {
    title: q ? `"${q}" — Search — Stoca` : 'Search — Stoca',
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, category } = await searchParams
  const query = q?.trim() ?? ''

  let stores: Array<{
    id: string
    name: string
    slug: string | null
    store_type: StoreType
    city: string | null
    state: string | null
    logo_url: string | null
  }> = []
  let products: StoreProduct[] = []
  let allCategories: string[] = []

  if (query) {
    // Search stores
    const storeData = await prisma.stores.findMany({
      where: {
        is_active: true,
        name: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, name: true, slug: true, store_type: true, city: true, state: true, logo_url: true },
      take: 12,
    })

    stores = storeData.map((s) => ({
      ...s,
      store_type: s.store_type as StoreType,
    }))

    // Search products
    const productData = await prisma.store_products.findMany({
      where: {
        is_available: true,
        name: { contains: query, mode: 'insensitive' },
        ...(category ? { category } : {}),
      },
      orderBy: [{ is_featured: 'desc' }, { name: 'asc' }],
      take: 40,
    })

    products = productData.map((p) => ({
      ...p,
      price: Number(p.price),
      compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
      low_stock_threshold: p.low_stock_threshold ?? 5,
      attributes: (p.attributes ?? {}) as Record<string, unknown>,
      embedding: null,
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
    }))

    // Get all categories from unfiltered product results for filter chips
    const allProductData = await prisma.store_products.findMany({
      where: {
        is_available: true,
        name: { contains: query, mode: 'insensitive' },
      },
      select: { category: true },
      distinct: ['category'],
    })

    allCategories = allProductData
      .map((p) => p.category)
      .filter((c): c is string => c !== null)
      .sort()
  } else {
    // No query: show all active stores
    const storeData = await prisma.stores.findMany({
      where: { is_active: true },
      select: { id: true, name: true, slug: true, store_type: true, city: true, state: true, logo_url: true },
      take: 24,
    })

    stores = storeData.map((s) => ({
      ...s,
      store_type: s.store_type as StoreType,
    }))
  }

  const hasResults = stores.length > 0 || products.length > 0
  const noQuery = !query

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Search Bar */}
      <form action="/search" method="GET" className="mb-10">
        <div className="relative mx-auto max-w-2xl">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search stores and products..."
            className="w-full rounded-full border border-secondary-300 bg-white py-3.5 pl-12 pr-4 text-base text-secondary-900 placeholder:text-secondary-400 shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </form>

      {/* No Query State */}
      {noQuery && stores.length > 0 && (
        <>
          <h2 className="mb-6 text-xl font-bold text-secondary-900">
            All Stores
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </>
      )}

      {/* Query with results */}
      {query && hasResults && (
        <>
          <p className="mb-8 text-sm text-secondary-500">
            Showing results for{' '}
            <span className="font-medium text-secondary-700">
              &ldquo;{query}&rdquo;
            </span>
          </p>

          {/* Stores Section */}
          {stores.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-secondary-900">
                <Store className="h-5 w-5 text-secondary-400" />
                Stores
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stores.map((store) => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </section>
          )}

          {/* Products Section */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-secondary-900">
              <Package className="h-5 w-5 text-secondary-400" />
              Products
              {products.length > 0 && (
                <span className="text-sm font-normal text-secondary-500">
                  ({products.length})
                </span>
              )}
            </h2>

            <SearchProducts
              products={products}
              categories={allCategories}
              activeCategory={category ?? null}
              query={query}
            />
          </section>
        </>
      )}

      {/* No Results */}
      {query && !hasResults && (
        <EmptyState
          icon={SearchIcon}
          title="No results found"
          description={`We couldn't find any stores or products matching "${query}". Try a different search term.`}
        />
      )}

      {/* No Stores at all */}
      {noQuery && stores.length === 0 && (
        <EmptyState
          icon={Store}
          title="No stores yet"
          description="Be the first to bring your neighborhood store online."
        />
      )}
    </div>
  )
}
