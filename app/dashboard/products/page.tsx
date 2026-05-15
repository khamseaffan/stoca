'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import {
  Search,
  Package,
  Plus,
  Bot,
  AlertTriangle,
} from 'lucide-react'
import { firstRenderableImageUrl } from '@/lib/images'
import { cn, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useDashboard } from '../DashboardContext'
import type { StoreProduct } from '@/types'

function getStockStatus(product: StoreProduct) {
  if (product.quantity === 0 || !product.is_available) {
    return { label: 'Out of stock', color: 'text-red-700 bg-red-100' } as const
  }
  if (product.quantity <= product.low_stock_threshold) {
    return { label: 'Low stock', color: 'text-amber-700 bg-amber-100' } as const
  }
  return { label: 'In stock', color: 'text-green-700 bg-green-100' } as const
}

export default function ProductsPage() {
  const { storeId } = useDashboard()
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [addModalOpen, setAddModalOpen] = useState(false)

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true)
      const supabase = createClient()

      const { data } = await supabase
        .from('store_products')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      setProducts(data ?? [])
      setLoading(false)
    }

    fetchProducts()
  }, [storeId])

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [products])

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      if (filterCategory !== 'ALL' && product.category !== filterCategory) {
        return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          product.name.toLowerCase().includes(q) ||
          (product.category?.toLowerCase().includes(q) ?? false) ||
          (product.description?.toLowerCase().includes(q) ?? false)
        )
      }

      return true
    })
  }, [products, searchQuery, filterCategory])

  // Stats
  const totalProducts = products.length
  const outOfStock = products.filter(
    (p) => p.quantity === 0 || !p.is_available,
  ).length
  const lowStock = products.filter(
    (p) =>
      p.is_available &&
      p.quantity > 0 &&
      p.quantity <= p.low_stock_threshold,
  ).length

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Products</h1>
          <p className="text-sm text-secondary-500">
            Manage your store inventory and product catalog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-dashboard-chat'))
            }}
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Ask Agent</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 border-b border-secondary-200 bg-white px-6 py-3">
        <div className="text-center">
          <p className="text-lg font-bold text-secondary-900">{totalProducts}</p>
          <p className="text-xs text-secondary-500">Total Products</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', lowStock > 0 ? 'text-amber-600' : 'text-secondary-900')}>
            {lowStock}
          </p>
          <p className="text-xs text-secondary-500">Low Stock</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', outOfStock > 0 ? 'text-red-600' : 'text-secondary-900')}>
            {outOfStock}
          </p>
          <p className="text-xs text-secondary-500">Out of Stock</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="bg-white border-b border-secondary-200 px-6 py-3 space-y-3">
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />

        {categories.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                filterCategory === 'ALL'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700',
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  filterCategory === cat
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description={
              searchQuery || filterCategory !== 'ALL'
                ? 'Try adjusting your search or filters.'
                : 'Add products to your store to start selling.'
            }
            action={
              !searchQuery && filterCategory === 'ALL' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const stock = getStockStatus(product)
              const isOutOfStock =
                product.quantity === 0 || !product.is_available
              const imageUrl = firstRenderableImageUrl(product.image_urls)

              return (
                <Card
                  key={product.id}
                  padding="none"
                  className={cn(
                    'overflow-hidden transition-shadow hover:shadow-md',
                    isOutOfStock && 'opacity-60',
                  )}
                >
                  {/* Image */}
                  <div className="aspect-square bg-secondary-100 relative overflow-hidden">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="h-12 w-12 text-secondary-300" />
                      </div>
                    )}

                    {/* Stock badge overlay */}
                    <div className="absolute top-2 right-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          stock.color,
                        )}
                      >
                        {stock.label}
                      </span>
                    </div>

                    {/* Featured badge */}
                    {product.is_featured && (
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white">
                          Featured
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-secondary-900 text-sm line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    {product.category && (
                      <p className="mt-0.5 text-xs text-secondary-500">
                        {product.category}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-secondary-900">
                          {formatPrice(product.price)}
                        </span>
                        {product.compare_at_price != null &&
                          product.compare_at_price > product.price && (
                            <span className="text-xs text-secondary-400 line-through">
                              {formatPrice(product.compare_at_price)}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Stock count */}
                    <div className="mt-2 flex items-center gap-1.5">
                      {product.quantity <= product.low_stock_threshold &&
                        product.quantity > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      <span
                        className={cn(
                          'text-xs font-medium',
                          product.quantity === 0
                            ? 'text-red-600'
                            : product.quantity <= product.low_stock_threshold
                              ? 'text-amber-600'
                              : 'text-green-600',
                        )}
                      >
                        {product.quantity} in stock
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Product modal placeholder */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Product"
        size="md"
      >
        <div className="space-y-4">
          <EmptyState
            icon={Package}
            title="Add from catalog or create custom"
            description="Use the AI assistant to quickly add products from the global catalog, or create a custom product for your store."
          />

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddModalOpen(false)
                window.dispatchEvent(new CustomEvent('open-dashboard-chat'))
                window.location.href = '/dashboard'
              }}
            >
              <Bot className="h-4 w-4" />
              Ask AI to Add
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
