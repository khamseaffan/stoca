'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ProductCard } from '@/components/commerce/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { StoreProduct } from '@/types'

interface SearchProductsProps {
  products: StoreProduct[]
  categories: string[]
  activeCategory: string | null
  query: string
}

export function SearchProducts({
  products,
  categories,
  activeCategory,
  query,
}: SearchProductsProps) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  const handleCategoryChange = useCallback(
    (category: string | null) => {
      const params = new URLSearchParams()
      params.set('q', query)
      if (category) {
        params.set('category', category)
      }
      router.push(`/search?${params.toString()}`)
    },
    [query, router]
  )

  const handleAddToCart = useCallback(async (productId: string) => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    // We need the store_id from the product — find it in the products array
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const { error } = await supabase.from('cart_items').upsert(
      {
        user_id: user.id,
        store_id: product.store_id,
        store_product_id: productId,
        quantity: 1,
        captured_price: 0, // DB trigger sets actual price
      },
      { onConflict: 'user_id,store_id,store_product_id' }
    )

    if (error) {
      setToast('Failed to add item to cart')
    } else {
      setToast('Added to cart')
    }

    setTimeout(() => setToast(null), 2500)
  }, [products])

  return (
    <div>
      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange(null)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
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
              onClick={() => handleCategoryChange(cat)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
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
      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
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
              ? `No products in "${activeCategory}" for this search.`
              : 'No products match your search. Try different keywords.'
          }
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-secondary-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
