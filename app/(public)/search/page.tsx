import Link from 'next/link'
import {
  Store,
  Package,
  Search as SearchIcon,
  ShoppingCart,
  Croissant,
  Beef,
  Pill,
  Wrench,
  UtensilsCrossed,
  Leaf,
  Sandwich,
  Flower2,
  PawPrint,
  Cpu,
  MoreHorizontal,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { StoreCard } from '@/components/commerce/StoreCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { StoreProduct, StoreType } from '@/types'
import { SearchProducts } from './SearchProducts'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Store-type category definitions                                    */
/* ------------------------------------------------------------------ */

const STORE_TYPE_CATEGORIES: Array<{
  type: StoreType
  label: string
  icon: typeof Store
  color: string
  activeBg: string
  activeText: string
}> = [
  { type: 'GROCERY',        label: 'Grocery',        icon: ShoppingCart,     color: 'text-emerald-600', activeBg: 'bg-emerald-50 border-emerald-200',  activeText: 'text-emerald-700' },
  { type: 'CONVENIENCE',    label: 'Convenience',    icon: Store,            color: 'text-sky-600',     activeBg: 'bg-sky-50 border-sky-200',          activeText: 'text-sky-700' },
  { type: 'BAKERY',         label: 'Bakery',         icon: Croissant,        color: 'text-amber-600',   activeBg: 'bg-amber-50 border-amber-200',      activeText: 'text-amber-700' },
  { type: 'BUTCHER',        label: 'Butcher',        icon: Beef,             color: 'text-red-600',     activeBg: 'bg-red-50 border-red-200',          activeText: 'text-red-700' },
  { type: 'PHARMACY',       label: 'Pharmacy',       icon: Pill,             color: 'text-blue-600',    activeBg: 'bg-blue-50 border-blue-200',        activeText: 'text-blue-700' },
  { type: 'HARDWARE',       label: 'Hardware',       icon: Wrench,           color: 'text-slate-600',   activeBg: 'bg-slate-50 border-slate-200',      activeText: 'text-slate-700' },
  { type: 'SPECIALTY_FOOD', label: 'Specialty',      icon: UtensilsCrossed,  color: 'text-violet-600',  activeBg: 'bg-violet-50 border-violet-200',    activeText: 'text-violet-700' },
  { type: 'ORGANIC',        label: 'Organic',        icon: Leaf,             color: 'text-lime-600',    activeBg: 'bg-lime-50 border-lime-200',        activeText: 'text-lime-700' },
  { type: 'DELI',           label: 'Deli',           icon: Sandwich,         color: 'text-orange-600',  activeBg: 'bg-orange-50 border-orange-200',    activeText: 'text-orange-700' },
  { type: 'FLOWER',         label: 'Flowers',        icon: Flower2,          color: 'text-pink-600',    activeBg: 'bg-pink-50 border-pink-200',        activeText: 'text-pink-700' },
  { type: 'PET',            label: 'Pet Store',      icon: PawPrint,         color: 'text-teal-600',    activeBg: 'bg-teal-50 border-teal-200',        activeText: 'text-teal-700' },
  { type: 'ELECTRONICS',    label: 'Electronics',    icon: Cpu,              color: 'text-indigo-600',  activeBg: 'bg-indigo-50 border-indigo-200',    activeText: 'text-indigo-700' },
  { type: 'OTHER',          label: 'Other',          icon: MoreHorizontal,   color: 'text-secondary-600', activeBg: 'bg-secondary-50 border-secondary-200', activeText: 'text-secondary-700' },
]

/* ------------------------------------------------------------------ */
/*  Shared select fields for store queries                             */
/* ------------------------------------------------------------------ */

const STORE_SELECT = {
  id: true,
  name: true,
  slug: true,
  store_type: true,
  city: true,
  state: true,
  logo_url: true,
  pickup_enabled: true,
  delivery_enabled: true,
  delivery_fee: true,
  operating_hours: true,
} as const

/* ------------------------------------------------------------------ */
/*  Page types                                                         */
/* ------------------------------------------------------------------ */

interface SearchPageProps {
  searchParams: Promise<{ q?: string; category?: string; type?: string }>
}

type StoreRow = {
  id: string
  name: string
  slug: string | null
  store_type: StoreType
  city: string | null
  state: string | null
  logo_url: string | null
  pickup_enabled: boolean
  delivery_enabled: boolean
  delivery_fee: number
  operating_hours: Record<string, { open: string; close: string }> | Record<string, never>
}

/* ------------------------------------------------------------------ */
/*  Helper: normalize raw Prisma row into StoreRow                     */
/* ------------------------------------------------------------------ */

function toStoreRow(s: Record<string, unknown>): StoreRow {
  return {
    ...(s as Omit<StoreRow, 'store_type' | 'delivery_fee' | 'operating_hours'>),
    store_type: s.store_type as StoreType,
    delivery_fee: Number(s.delivery_fee),
    operating_hours: (s.operating_hours ?? {}) as StoreRow['operating_hours'],
  }
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q, type } = await searchParams
  if (q) {
    return { title: `"${q}" -- Search -- Stoca` }
  }
  if (type) {
    const cat = STORE_TYPE_CATEGORIES.find((c) => c.type === type)
    return { title: cat ? `${cat.label} Stores -- Stoca` : 'Browse Stores -- Stoca' }
  }
  return { title: 'Browse Stores -- Stoca' }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, category, type } = await searchParams
  const query = q?.trim() ?? ''
  const activeType = type?.trim() || null

  let stores: StoreRow[] = []
  let products: StoreProduct[] = []
  let allCategories: string[] = []

  if (query) {
    /* ---- Search mode: query present ---- */

    const storeData = await prisma.stores.findMany({
      where: {
        is_active: true,
        name: { contains: query, mode: 'insensitive' },
        ...(activeType ? { store_type: activeType } : {}),
      },
      select: STORE_SELECT,
      take: 12,
    })
    stores = storeData.map((s) => toStoreRow(s as unknown as Record<string, unknown>))

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

    // Get distinct product categories for filter chips
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
    /* ---- Browse mode: no query ---- */

    const storeData = await prisma.stores.findMany({
      where: {
        is_active: true,
        ...(activeType ? { store_type: activeType } : {}),
      },
      select: STORE_SELECT,
      orderBy: { name: 'asc' },
      take: 48,
    })
    stores = storeData.map((s) => toStoreRow(s as unknown as Record<string, unknown>))
  }

  const hasResults = stores.length > 0 || products.length > 0
  const isSearchMode = !!query

  /* ---- Get counts per store type for the category row (browse mode) ---- */
  let typeCounts: Partial<Record<StoreType, number>> = {}
  if (!isSearchMode) {
    const counts = await prisma.stores.groupBy({
      by: ['store_type'],
      where: { is_active: true },
      _count: { id: true },
    })
    typeCounts = Object.fromEntries(
      counts.map((c) => [c.store_type as StoreType, c._count.id])
    ) as Partial<Record<StoreType, number>>
  }

  // Only show categories that actually have stores
  const availableCategories = STORE_TYPE_CATEGORIES.filter(
    (cat) => (typeCounts[cat.type] ?? 0) > 0
  )

  const activeTypeLabel = activeType
    ? STORE_TYPE_CATEGORIES.find((c) => c.type === activeType)?.label ?? 'Stores'
    : null

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ================================================================ */}
      {/*  Search mode: query is present                                    */}
      {/* ================================================================ */}
      {isSearchMode && (
        <>
          {/* Search heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
              Results for &ldquo;{query}&rdquo;
            </h1>
            <p className="mt-1 text-sm text-secondary-500">
              {stores.length} {stores.length === 1 ? 'store' : 'stores'}
              {products.length > 0 && ` and ${products.length} ${products.length === 1 ? 'product' : 'products'}`}
              {' '}found
            </p>
          </div>

          {hasResults ? (
            <>
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
          ) : (
            <EmptyState
              icon={SearchIcon}
              title="No results found"
              description={`We couldn't find any stores or products matching "${query}". Try a different search term.`}
            />
          )}
        </>
      )}

      {/* ================================================================ */}
      {/*  Browse mode: no query                                            */}
      {/* ================================================================ */}
      {!isSearchMode && (
        <>
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
              {activeTypeLabel ? `${activeTypeLabel} Stores` : 'Browse Stores'}
            </h1>
            <p className="mt-1 text-sm text-secondary-500">
              {activeTypeLabel
                ? `${stores.length} ${activeTypeLabel.toLowerCase()} ${stores.length === 1 ? 'store' : 'stores'} near you`
                : 'Discover local stores in your neighborhood'}
            </p>
          </div>

          {/* Category filter row */}
          {availableCategories.length > 0 && (
            <nav className="mb-8 -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Store categories">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
                {/* "All" pill */}
                <Link
                  href="/search"
                  className={cn(
                    'flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150',
                    !activeType
                      ? 'border-primary-200 bg-primary-50 text-primary-700 shadow-sm'
                      : 'border-secondary-200 bg-white text-secondary-600 hover:bg-secondary-50 hover:border-secondary-300',
                  )}
                >
                  <Store className="h-4 w-4" />
                  All
                </Link>

                {availableCategories.map((cat) => {
                  const Icon = cat.icon
                  const isActive = activeType === cat.type
                  return (
                    <Link
                      key={cat.type}
                      href={`/search?type=${cat.type}`}
                      className={cn(
                        'flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150',
                        isActive
                          ? `${cat.activeBg} ${cat.activeText} shadow-sm`
                          : 'border-secondary-200 bg-white text-secondary-600 hover:bg-secondary-50 hover:border-secondary-300',
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive ? cat.activeText : cat.color)} />
                      {cat.label}
                      <span className={cn(
                        'text-xs',
                        isActive ? 'opacity-70' : 'text-secondary-400',
                      )}>
                        {typeCounts[cat.type] ?? 0}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </nav>
          )}

          {/* Store grid */}
          {stores.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Store}
              title={activeType ? 'No stores in this category' : 'No stores yet'}
              description={
                activeType
                  ? 'Try browsing a different category or check back later.'
                  : 'Be the first to bring your neighborhood store online.'
              }
              action={
                activeType ? (
                  <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    View all stores
                  </Link>
                ) : undefined
              }
            />
          )}
        </>
      )}
    </div>
  )
}
