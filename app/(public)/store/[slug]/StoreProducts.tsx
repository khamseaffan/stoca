'use client'

import { useState, useCallback, useMemo } from 'react'
import { Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/posthog'
import { ProductCard } from '@/components/commerce/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import type { StoreProduct } from '@/types'

interface StoreProductsProps {
  products: StoreProduct[]
  storeId: string
}

export function StoreProducts({ products, storeId }: StoreProductsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()

  /** Map of category name to product count (computed from ALL products, ignoring search). */
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const product of products) {
      if (product.category) {
        counts.set(product.category, (counts.get(product.category) ?? 0) + 1)
      }
    }
    return counts
  }, [products])

  const categories = useMemo(() => {
    return Array.from(categoryCounts.keys()).sort()
  }, [categoryCounts])

  const filteredProducts = useMemo(() => {
    let result = products

    // Filter by category
    if (activeCategory) {
      result = result.filter((p) => p.category === activeCategory)
    }

    // Filter by search query
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(query)
      )
    }

    return result
  }, [products, activeCategory, searchQuery])

  const handleAddToCart = useCallback(
    async (productId: string) => {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { error } = await supabase.from('cart_items').upsert(
        {
          user_id: user.id,
          store_id: storeId,
          store_product_id: productId,
          quantity: 1,
          captured_price: 0, // DB trigger sets actual price
        },
        { onConflict: 'user_id,store_id,store_product_id' }
      )

      if (error) {
        toast({ title: 'Failed to add to cart', variant: 'error' })
      } else {
        toast({ title: 'Added to cart', variant: 'success' })
        trackEvent.productAddedToCart(productId)
      }
    },
    [storeId, toast]
  )

  return (
    <div className="pb-16">
      {/* Sticky toolbar: search + category pills */}
      <div className="sticky top-16 z-30 -mx-4 mb-8 bg-white px-4 pb-3 pt-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {/* Search input */}
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-full border border-secondary-200 bg-secondary-50 py-2 pl-9 pr-4 text-sm text-secondary-900 placeholder:text-secondary-400 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                activeCategory === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
              )}
            >
              All ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
                )}
              >
                {cat} ({categoryCounts.get(cat) ?? 0})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result count */}
      <p className="mb-4 text-sm text-secondary-500">
        Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
      </p>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No products found"
          description={
            searchQuery.trim()
              ? `No products matching "${searchQuery.trim()}"${activeCategory ? ` in "${activeCategory}"` : ''}.`
              : activeCategory
                ? `No products in the "${activeCategory}" category.`
                : 'This store has no products listed yet.'
          }
        />
      )}
    </div>
  )
}
