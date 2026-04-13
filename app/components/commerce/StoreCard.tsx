import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Store } from '@/types'

export interface StoreCardProps {
  store: Pick<Store, 'id' | 'name' | 'slug' | 'store_type' | 'city' | 'state' | 'logo_url'>
}

function formatStoreType(storeType: string): string {
  return storeType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StoreCard({ store }: StoreCardProps) {
  return (
    <Link
      href={`/store/${store.slug}`}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-secondary-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
      )}
    >
      <div className="flex-shrink-0">
        {store.logo_url ? (
          <Image
            src={store.logo_url}
            alt={store.name}
            width={60}
            height={60}
            className="rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-lg bg-primary-600 text-lg font-semibold text-white">
            {store.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-secondary-900">
          {store.name}
        </h3>
        <div className="mt-1">
          <Badge variant="default" size="sm">
            {formatStoreType(store.store_type)}
          </Badge>
        </div>
        {(store.city || store.state) && (
          <p className="mt-1 text-sm text-secondary-500">
            {[store.city, store.state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
    </Link>
  )
}
