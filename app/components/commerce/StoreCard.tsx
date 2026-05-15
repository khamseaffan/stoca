import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Truck, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Store, StoreType } from '@/types'

export interface StoreCardProps {
  store: Pick<
    Store,
    | 'id'
    | 'name'
    | 'slug'
    | 'store_type'
    | 'city'
    | 'state'
    | 'logo_url'
    | 'pickup_enabled'
    | 'delivery_enabled'
    | 'delivery_fee'
    | 'operating_hours'
  >
}

/* ------------------------------------------------------------------ */
/*  Store-type accent colors                                          */
/* ------------------------------------------------------------------ */

const storeTypeAccent: Record<StoreType, { strip: string; logoBg: string; badge: string }> = {
  GROCERY:        { strip: 'bg-emerald-500', logoBg: 'bg-emerald-50',  badge: 'bg-emerald-100 text-emerald-700' },
  CONVENIENCE:    { strip: 'bg-sky-500',     logoBg: 'bg-sky-50',      badge: 'bg-sky-100 text-sky-700' },
  BAKERY:         { strip: 'bg-amber-500',   logoBg: 'bg-amber-50',    badge: 'bg-amber-100 text-amber-700' },
  BUTCHER:        { strip: 'bg-red-500',     logoBg: 'bg-red-50',      badge: 'bg-red-100 text-red-700' },
  PHARMACY:       { strip: 'bg-blue-500',    logoBg: 'bg-blue-50',     badge: 'bg-blue-100 text-blue-700' },
  HARDWARE:       { strip: 'bg-slate-500',   logoBg: 'bg-slate-50',    badge: 'bg-slate-100 text-slate-700' },
  SPECIALTY_FOOD: { strip: 'bg-violet-500',  logoBg: 'bg-violet-50',   badge: 'bg-violet-100 text-violet-700' },
  ORGANIC:        { strip: 'bg-lime-500',    logoBg: 'bg-lime-50',     badge: 'bg-lime-100 text-lime-700' },
  DELI:           { strip: 'bg-orange-500',  logoBg: 'bg-orange-50',   badge: 'bg-orange-100 text-orange-700' },
  FLOWER:         { strip: 'bg-pink-500',    logoBg: 'bg-pink-50',     badge: 'bg-pink-100 text-pink-700' },
  PET:            { strip: 'bg-teal-500',    logoBg: 'bg-teal-50',     badge: 'bg-teal-100 text-teal-700' },
  ELECTRONICS:    { strip: 'bg-indigo-500',  logoBg: 'bg-indigo-50',   badge: 'bg-indigo-100 text-indigo-700' },
  OTHER:          { strip: 'bg-secondary-500', logoBg: 'bg-secondary-50', badge: 'bg-secondary-100 text-secondary-700' },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatStoreType(storeType: string): string {
  return storeType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isStoreOpen(
  hours: Record<string, { open: string; close: string }> | Record<string, never> | null,
): boolean {
  if (!hours || Object.keys(hours).length === 0) return false
  const now = new Date()
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const today = days[now.getDay()]
  const todayHours = hours[today] as { open: string; close: string } | undefined
  if (!todayHours || todayHours.open === 'closed') return false
  const [openH, openM] = todayHours.open.split(':').map(Number)
  const [closeH, closeM] = todayHours.close.split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM
}

function formatDeliveryFee(fee: number): string {
  if (fee === 0) return 'Free delivery'
  return `Delivery ($${fee.toFixed(2)})`
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StoreCard({ store }: StoreCardProps) {
  const accent = storeTypeAccent[store.store_type] ?? storeTypeAccent.OTHER
  const open = isStoreOpen(store.operating_hours)
  const hasLocation = store.city || store.state
  const hasFulfillment = store.pickup_enabled || store.delivery_enabled

  return (
    <Link
      href={`/store/${store.slug}`}
      className={cn(
        'group relative flex overflow-hidden rounded-xl border border-secondary-200 bg-white shadow-sm',
        'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      )}
    >
      {/* Colored accent strip on the left */}
      <div className={cn('w-1.5 flex-shrink-0', accent.strip)} />

      {/* Card body */}
      <div className="flex min-w-0 flex-1 gap-4 p-4">
        {/* Logo area with colored background */}
        <div
          className={cn(
            'flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
            accent.logoBg,
          )}
        >
          {store.logo_url ? (
            <Image
              src={store.logo_url}
              alt={store.name}
              width={48}
              height={48}
              className="rounded-lg object-cover"
            />
          ) : (
            <span className={cn('text-xl font-bold', accent.strip.replace('bg-', 'text-'))}>
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Top row: name + open/closed */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-secondary-900">
              {store.name}
            </h3>
            <span
              className={cn(
                'mt-0.5 flex flex-shrink-0 items-center gap-1.5 text-xs font-medium',
                open ? 'text-green-600' : 'text-secondary-400',
              )}
            >
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  open ? 'bg-green-500' : 'bg-secondary-300',
                )}
              />
              {open ? 'Open' : 'Closed'}
            </span>
          </div>

          {/* Store type badge */}
          <div className="mt-1.5">
            <Badge variant="default" size="sm" className={accent.badge}>
              {formatStoreType(store.store_type)}
            </Badge>
          </div>

          {/* Location */}
          {hasLocation && (
            <p className="mt-2 flex items-center gap-1 text-sm text-secondary-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {[store.city, store.state].filter(Boolean).join(', ')}
              </span>
            </p>
          )}

          {/* Fulfillment options */}
          {hasFulfillment && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary-500">
              {store.pickup_enabled && (
                <span className="flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" />
                  Pickup
                </span>
              )}
              {store.delivery_enabled && (
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {formatDeliveryFee(store.delivery_fee)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
