'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, ShoppingCart } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { StoreProduct } from '@/types'

export interface ProductCardProps {
  product: StoreProduct
  onAddToCart: (productId: string) => void
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const isOutOfStock = product.quantity === 0 || !product.is_available
  const isLowStock =
    !isOutOfStock &&
    product.quantity > 0 &&
    product.quantity <= product.low_stock_threshold

  return (
    <div
      className={cn(
        'group relative bg-white rounded-xl shadow-sm border border-secondary-200 overflow-hidden hover:shadow-md transition-shadow',
        isOutOfStock && 'opacity-60',
      )}
    >
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square bg-secondary-100 relative overflow-hidden">
          {product.image_urls.length > 0 ? (
            <Image
              src={product.image_urls[0]}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-12 w-12 text-secondary-300" />
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <span className="rounded-full bg-secondary-200 px-3 py-1 text-xs font-medium text-secondary-600">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="font-medium text-secondary-900 line-clamp-2 text-sm leading-snug">
            {product.name}
          </p>
          {product.category && (
            <p className="mt-1 text-xs text-secondary-500">{product.category}</p>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span className="text-base font-semibold text-secondary-900">
              {formatPrice(product.price)}
            </span>
            {product.compare_at_price != null &&
              product.compare_at_price > product.price && (
                <span className="text-sm text-secondary-400 line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
          </div>

          {isLowStock && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Only {product.quantity} left
            </p>
          )}
        </div>
      </Link>

      <div className="px-4 pb-4">
        {isOutOfStock ? (
          <Button variant="secondary" size="sm" disabled className="w-full">
            Out of Stock
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault()
              onAddToCart(product.id)
            }}
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </Button>
        )}
      </div>
    </div>
  )
}
