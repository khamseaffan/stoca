import { notFound } from 'next/navigation'
import { MapPin, Phone, Clock, Truck, ShoppingBag, DollarSign, Package } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { cn, getInitials, formatPrice } from '@/lib/utils'
import { isRenderableImageUrl } from '@/lib/images'
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

function isStoreOpen(hours: Record<string, { open: string; close: string }> | null): boolean {
  if (!hours) return false
  const now = new Date()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[now.getDay()]
  const todayHours = hours[today]
  if (!todayHours || todayHours.open === 'closed') return false
  const [openH, openM] = todayHours.open.split(':').map(Number)
  const [closeH, closeM] = todayHours.close.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM
}

function formatTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'pm' : 'am'
  const displayHours = hours % 12 || 12
  if (minutes === 0) return `${displayHours}${period}`
  return `${displayHours}:${String(minutes).padStart(2, '0')}${period}`
}

function getStoreStatus(
  hours: Record<string, { open: string; close: string }> | null
): { status: 'open' | 'closing_soon' | 'closed'; label: string } {
  if (!hours) return { status: 'closed', label: 'Closed' }

  const now = new Date()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayIndex = now.getDay()
  const today = days[todayIndex]
  const todayHours = hours[today]
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  if (todayHours && todayHours.open !== 'closed') {
    const [openH, openM] = todayHours.open.split(':').map(Number)
    const [closeH, closeM] = todayHours.close.split(':').map(Number)
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      const minutesUntilClose = closeMinutes - currentMinutes
      if (minutesUntilClose <= 60) {
        return {
          status: 'closing_soon',
          label: `Closing soon · Closes at ${formatTime(closeH, closeM)}`,
        }
      }
      return {
        status: 'open',
        label: `Open · Closes at ${formatTime(closeH, closeM)}`,
      }
    }

    // Store hasn't opened yet today
    if (currentMinutes < openMinutes) {
      return {
        status: 'closed',
        label: `Closed · Opens today at ${formatTime(openH, openM)}`,
      }
    }
  }

  // Store is closed today or already closed - find next opening
  for (let offset = 1; offset <= 7; offset++) {
    const nextDayIndex = (todayIndex + offset) % 7
    const nextDay = days[nextDayIndex]
    const nextDayHours = hours[nextDay]

    if (nextDayHours && nextDayHours.open !== 'closed') {
      const [nextOpenH, nextOpenM] = nextDayHours.open.split(':').map(Number)
      const dayLabel = offset === 1 ? 'tomorrow' : nextDay.charAt(0).toUpperCase() + nextDay.slice(1)
      return {
        status: 'closed',
        label: `Closed · Opens ${dayLabel} at ${formatTime(nextOpenH, nextOpenM)}`,
      }
    }
  }

  return { status: 'closed', label: 'Closed' }
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

  const storeStatus = getStoreStatus(
    typedStore.operating_hours as Record<string, { open: string; close: string }> | null
  )

  const orderTypeLabel = typedStore.pickup_enabled && typedStore.delivery_enabled
    ? 'Pickup & Delivery'
    : typedStore.pickup_enabled
      ? 'Pickup only'
      : typedStore.delivery_enabled
        ? 'Delivery only'
        : 'Contact store'

  const deliveryFeeLabel = !typedStore.delivery_enabled
    ? 'N/A'
    : typedStore.delivery_fee === 0
      ? 'Free delivery'
      : formatPrice(typedStore.delivery_fee)
  const bannerUrl = isRenderableImageUrl(typedStore.banner_url)
    ? typedStore.banner_url
    : null
  const logoUrl = isRenderableImageUrl(typedStore.logo_url)
    ? typedStore.logo_url
    : null

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative h-56 sm:h-64 lg:h-72 overflow-hidden">
        {/* Background: banner image with overlay, or gradient with store type texture */}
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900">
            <span className="absolute bottom-4 right-6 text-[6rem] font-black uppercase leading-none tracking-tighter text-white/[0.04] select-none sm:text-[8rem] lg:text-[10rem]">
              {formatStoreType(typedStore.store_type)}
            </span>
          </div>
        )}

        {/* Hero overlay content */}
        <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-5 sm:px-6 lg:px-8 mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            {/* Left: Logo + name + status */}
            <div className="flex items-end gap-4">
              {/* Logo - 80px */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white/20 bg-white/10 shadow-lg backdrop-blur-sm">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={typedStore.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {getInitials(typedStore.name)}
                  </span>
                )}
              </div>

              <div className="min-w-0 pb-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold text-white sm:text-2xl lg:text-3xl">
                    {typedStore.name}
                  </h1>
                  <Badge variant="default" className="bg-white/15 text-white backdrop-blur-sm">
                    {formatStoreType(typedStore.store_type)}
                  </Badge>
                </div>

                {/* Status indicator */}
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-full ring-2',
                      storeStatus.status === 'open' && 'bg-green-400 ring-green-400/30',
                      storeStatus.status === 'closing_soon' && 'bg-amber-400 ring-amber-400/30',
                      storeStatus.status === 'closed' && 'bg-red-400 ring-red-400/30',
                    )}
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      storeStatus.status === 'open' && 'text-green-300',
                      storeStatus.status === 'closing_soon' && 'text-amber-300',
                      storeStatus.status === 'closed' && 'text-red-300',
                    )}
                  >
                    {storeStatus.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Stat tiles */}
            <div className="flex gap-2 sm:gap-3">
              <div className="flex flex-col items-center rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-2.5">
                <Truck className="mb-1 h-4 w-4 text-white/70" />
                <span className="text-xs font-semibold text-white">{deliveryFeeLabel}</span>
                <span className="text-[10px] text-white/60">Delivery fee</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-2.5">
                <DollarSign className="mb-1 h-4 w-4 text-white/70" />
                <span className="text-xs font-semibold text-white">
                  {typedStore.minimum_order > 0 ? formatPrice(typedStore.minimum_order) : 'None'}
                </span>
                <span className="text-[10px] text-white/60">Min. order</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-2.5">
                <Package className="mb-1 h-4 w-4 text-white/70" />
                <span className="text-xs font-semibold text-white">{orderTypeLabel}</span>
                <span className="text-[10px] text-white/60">Order type</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Store Info (below hero) */}
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 mt-5">
          {typedStore.description && (
            <p className="max-w-2xl text-secondary-600">
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
          </div>
        </div>

        {/* Products */}
        <StoreProducts products={typedProducts} storeId={typedStore.id} />
      </div>
    </div>
  )
}
