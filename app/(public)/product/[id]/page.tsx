import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ArrowLeft, MapPin, ShoppingBag, Truck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import type { StoreProduct, Store, StoreType } from '@/types'
import { AddToCartButton } from './AddToCartButton'

interface ProductPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { id } = await params

  const data = await prisma.store_products.findUnique({
    where: { id },
    select: { name: true, description: true, price: true },
  })

  if (!data) {
    return { title: 'Product Not Found' }
  }

  return {
    title: `${data.name} — Stoca`,
    description: data.description ?? `${data.name} available on Stoca.`,
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params

  // Fetch the product along with its store
  const product = await prisma.store_products.findUnique({
    where: { id },
  })

  if (!product) {
    notFound()
  }

  const typedProduct: StoreProduct = {
    ...product,
    price: Number(product.price),
    compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : null,
    low_stock_threshold: product.low_stock_threshold ?? 5,
    attributes: (product.attributes ?? {}) as Record<string, unknown>,
    embedding: null,
    created_at: product.created_at.toISOString(),
    updated_at: product.updated_at.toISOString(),
  }

  // Fetch the parent store
  const store = await prisma.stores.findFirst({
    where: { id: typedProduct.store_id, is_active: true },
    select: { id: true, name: true, slug: true, store_type: true, city: true, state: true, pickup_enabled: true, delivery_enabled: true },
  })

  if (!store) {
    notFound()
  }

  const typedStore: Pick<
    Store,
    'id' | 'name' | 'slug' | 'store_type' | 'city' | 'state' | 'pickup_enabled' | 'delivery_enabled'
  > = {
    ...store,
    store_type: store.store_type as StoreType,
  }

  const isOutOfStock = typedProduct.quantity === 0 || !typedProduct.is_available
  const isLowStock =
    !isOutOfStock &&
    typedProduct.quantity > 0 &&
    typedProduct.quantity <= typedProduct.low_stock_threshold

  function formatStoreType(storeType: string): string {
    return storeType
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Back Link */}
      <Link
        href={`/store/${typedStore.slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-secondary-500 transition-colors hover:text-secondary-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {typedStore.name}
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column: Image */}
        <div className="aspect-square overflow-hidden rounded-2xl bg-secondary-100">
          {typedProduct.image_urls.length > 0 ? (
            <Image
              src={typedProduct.image_urls[0]}
              alt={typedProduct.name}
              width={700}
              height={700}
              className="h-full w-full object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-24 w-24 text-secondary-300" />
            </div>
          )}
        </div>

        {/* Right Column: Details */}
        <div className="flex flex-col">
          {/* Category Badge */}
          {typedProduct.category && (
            <div className="mb-3">
              <Badge variant="default">{typedProduct.category}</Badge>
            </div>
          )}

          {/* Product Name */}
          <h1 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
            {typedProduct.name}
          </h1>

          {/* Pricing */}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-secondary-900">
              {formatPrice(typedProduct.price)}
            </span>
            {typedProduct.compare_at_price != null &&
              typedProduct.compare_at_price > typedProduct.price && (
                <span className="text-xl text-secondary-400 line-through">
                  {formatPrice(typedProduct.compare_at_price)}
                </span>
              )}
          </div>

          {/* Stock Status */}
          <div className="mt-3">
            {isOutOfStock ? (
              <span className="text-sm font-medium text-red-600">
                Out of stock
              </span>
            ) : isLowStock ? (
              <span className="text-sm font-medium text-amber-600">
                Only {typedProduct.quantity} left in stock
              </span>
            ) : (
              <span className="text-sm font-medium text-primary-600">
                In stock
              </span>
            )}
          </div>

          {/* Description */}
          {typedProduct.description && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-secondary-500">
                Description
              </h2>
              <p className="mt-2 leading-relaxed text-secondary-700">
                {typedProduct.description}
              </p>
            </div>
          )}

          {/* Add to Cart Button */}
          <div className="mt-8">
            <AddToCartButton
              productId={typedProduct.id}
              storeId={typedProduct.store_id}
              available={!isOutOfStock}
            />
          </div>

          {/* Store Info Card */}
          <Card className="mt-8" padding="md">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-secondary-500">
              Sold by
            </h3>
            <Link
              href={`/store/${typedStore.slug}`}
              className="block transition-colors hover:text-primary-600"
            >
              <p className="font-semibold text-secondary-900">
                {typedStore.name}
              </p>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-secondary-500">
              <Badge variant="default" size="sm">
                {formatStoreType(typedStore.store_type)}
              </Badge>
              {(typedStore.city || typedStore.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[typedStore.city, typedStore.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-secondary-500">
              {typedStore.pickup_enabled && (
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-primary-500" />
                  Pickup available
                </span>
              )}
              {typedStore.delivery_enabled && (
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary-500" />
                  Delivery available
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
