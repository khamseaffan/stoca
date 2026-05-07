'use client'

import { useState, useCallback, useMemo } from 'react'
import { Package } from 'lucide-react'
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
  const { toast } = useToast()

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const product of products) {
      if (product.category) {
        cats.add(product.category)
      }
    }
    return Array.from(cats).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return products
    return products.filter((p) => p.category === activeCategory)
  }, [products, activeCategory])

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
      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeCategory === null
                ? 'bg-primary-600 text-white'
                : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
            activeCategory
              ? `No products in the "${activeCategory}" category.`
              : 'This store has no products listed yet.'
          }
        />
      )}

    </div>
  )
}
