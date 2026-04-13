import { notFound } from 'next/navigation'
import { MapPin, Phone, Clock, Truck, ShoppingBag } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { getInitials } from '@/lib/utils'
import type { Store, StoreProduct, StoreType } from '@/types'
import { StoreProducts } from './StoreProducts'

interface StorePageProps {
  params: Promise<{ slug: string }>
}

function formatStoreType(storeType: string): string {
  return storeType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function generateMetadata({ params }: StorePageProps) {
  const { slug } = await params

  const store = await prisma.stores.findFirst({
    where: { slug, is_active: true },
    select: { name: true, description: true, store_type: true },
  })

  if (!store) {
    return { title: 'Store Not Found' }
  }

  return {
    title: `${store.name} — Stoca`,
    description:
      store.description ??
      `Shop at ${store.name}, a local ${formatStoreType(store.store_type).toLowerCase()} on Stoca.`,
  }
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params

  const store = await prisma.stores.findFirst({
    where: { slug, is_active: true },
  })

  if (!store) {
    notFound()
  }

  const typedStore: Store = {
    ...store,
    store_type: store.store_type as StoreType,
    country: store.country ?? 'US',
    latitude: store.latitude ? Number(store.latitude) : null,
    longitude: store.longitude ? Number(store.longitude) : null,
    delivery_fee: Number(store.delivery_fee ?? 0),
    minimum_order: Number(store.minimum_order ?? 0),
    delivery_radius_km: store.delivery_radius_km ? Number(store.delivery_radius_km) : null,
    operating_hours: (store.operating_hours ?? {}) as Store['operating_hours'],
    created_at: store.created_at.toISOString(),
    updated_at: store.updated_at.toISOString(),
  }

  const productData = await prisma.store_products.findMany({
    where: { store_id: typedStore.id, is_available: true },
    orderBy: [{ is_featured: 'desc' }, { name: 'asc' }],
  })

  const typedProducts: StoreProduct[] = productData.map((p) => ({
    ...p,
    price: Number(p.price),
    compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
    low_stock_threshold: p.low_stock_threshold ?? 5,
    attributes: (p.attributes ?? {}) as Record<string, unknown>,
    embedding: null,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  }))

  const address = [
    typedStore.street_address,
    typedStore.city,
    typedStore.state,
    typedStore.zipcode,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div>
      {/* Store Header / Banner */}
      <div
        className="relative h-48 sm:h-56 lg:h-64"
        style={
          typedStore.banner_url
            ? {
                backgroundImage: `url(${typedStore.banner_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {!typedStore.banner_url && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100" />
        )}
        {typedStore.banner_url && (
          <div className="absolute inset-0 bg-black/20" />
        )}
      </div>

      {/* Store Info */}
      <div className="mx-auto max-w-7xl px-4">
        <div className="relative -mt-16 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          {/* Logo / Initial */}
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-primary-600 shadow-lg sm:h-32 sm:w-32">
            {typedStore.logo_url ? (
              <img
                src={typedStore.logo_url}
                alt={typedStore.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-white sm:text-4xl">
                {getInitials(typedStore.name)}
              </span>
            )}
          </div>

          {/* Name + Meta */}
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
                {typedStore.name}
              </h1>
              <Badge variant="default">
                {formatStoreType(typedStore.store_type)}
              </Badge>
            </div>
            {typedStore.description && (
              <p className="mt-2 max-w-2xl text-secondary-600">
                {typedStore.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-secondary-500">
              {address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-secondary-400" />
                  {address}
                </span>
              )}
              {typedStore.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-secondary-400" />
                  {typedStore.phone}
                </span>
              )}
              {typedStore.pickup_enabled && (
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-secondary-400" />
                  Pickup
                </span>
              )}
              {typedStore.delivery_enabled && (
                <span className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-secondary-400" />
                  Delivery
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Products */}
        <StoreProducts products={typedProducts} storeId={typedStore.id} />
      </div>
    </div>
  )
}
