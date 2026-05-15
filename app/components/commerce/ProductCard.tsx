'use client'

import Image from 'next/image'
import { Package, Plus } from 'lucide-react'
import { firstRenderableImageUrl } from '@/lib/images'
import { cn, formatPrice } from '@/lib/utils'
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

  const isOnSale =
    product.compare_at_price != null && product.compare_at_price > product.price
  const discountPercent = isOnSale
    ? Math.round(
        ((product.compare_at_price! - product.price) /
          product.compare_at_price!) *
          100,
      )
    : 0
  const imageUrl = firstRenderableImageUrl(product.image_urls)

  return (
    <div
      className={cn(
        'group relative bg-white rounded-xl shadow-sm border border-secondary-200 overflow-hidden hover:shadow-lg transition-all duration-300',
        isOutOfStock && 'opacity-60',
      )}
    >
      {/* Image area */}
      <div className="aspect-square bg-secondary-100 relative overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
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

        {/* Top-left badges: Sale or Featured */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isOnSale && (
            <span className="inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
              {discountPercent}% off
            </span>
          )}
          {product.is_featured && (
            <span className="inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-900 shadow-sm">
              Featured
            </span>
          )}
        </div>

        {/* Top-right badge: Low stock */}
        {isLowStock && (
          <span className="absolute top-2 right-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 shadow-sm">
            Only {product.quantity} left
          </span>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <span className="rounded-full bg-secondary-200 px-3 py-1 text-xs font-medium text-secondary-600">
              Out of Stock
            </span>
          </div>
        )}

        {/* Add to cart button overlaid on bottom-right of image */}
        {!isOutOfStock && (
          <button
            type="button"
            onClick={() => onAddToCart(product.id)}
            className={cn(
              'absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white shadow-md transition-all duration-200',
              'hover:bg-primary-700 hover:scale-110 active:scale-95',
              'opacity-100 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            )}
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Product info */}
      <div className="p-3">
        {/* Price row -- prominent and always above the fold */}
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-lg font-bold tracking-tight',
              isOnSale ? 'text-red-600' : 'text-secondary-900',
            )}
          >
            {formatPrice(product.price)}
          </span>
          {isOnSale && (
            <span className="text-sm text-secondary-400 line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          )}
        </div>

        {/* Product name */}
        <p className="mt-1 font-medium text-secondary-900 line-clamp-2 text-sm leading-snug">
          {product.name}
        </p>

        {/* Category */}
        {product.category && (
          <p className="mt-0.5 text-xs text-secondary-500">
            {product.category}
          </p>
        )}
      </div>
    </div>
  )
}
