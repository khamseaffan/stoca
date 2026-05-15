import Link from 'next/link'
import {
  Search,
  ShoppingCart,
  Package,
  ShoppingBasket,
  CakeSlice,
  Coffee,
  Store,
  Beef,
  Pill,
  Sandwich,
  Flower2,
  PawPrint,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/Button'
import { StoreCard } from '@/components/commerce/StoreCard'
import type { StoreType } from '@/types'

const categories = [
  { label: 'Grocery', type: 'GROCERY', icon: ShoppingBasket },
  { label: 'Bakery', type: 'BAKERY', icon: CakeSlice },
  { label: 'Coffee', type: 'SPECIALTY_FOOD', icon: Coffee },
  { label: 'Convenience', type: 'CONVENIENCE', icon: Store },
  { label: 'Butcher', type: 'BUTCHER', icon: Beef },
  { label: 'Pharmacy', type: 'PHARMACY', icon: Pill },
  { label: 'Deli', type: 'DELI', icon: Sandwich },
  { label: 'Flower Shop', type: 'FLOWER', icon: Flower2 },
  { label: 'Pet Store', type: 'PET', icon: PawPrint },
]

export default async function HomePage() {
  const storeData = await prisma.stores.findMany({
    where: { is_active: true },
    take: 6,
    select: {
      id: true, name: true, slug: true, store_type: true,
      city: true, state: true, logo_url: true,
      pickup_enabled: true, delivery_enabled: true, delivery_fee: true, operating_hours: true,
    },
  })

  const stores = storeData.map((s) => ({
    ...s,
    store_type: s.store_type as StoreType,
    delivery_fee: Number(s.delivery_fee),
    operating_hours: (s.operating_hours ?? {}) as Record<string, { open: string; close: string }>,
  }))

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-secondary-900 sm:text-5xl lg:text-6xl">
              Your neighborhood stores,{' '}
              <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
                online
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-secondary-600">
              Discover local stores, browse products, and order for pickup — all
              powered by AI.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/search">
                <Button variant="primary" size="lg">
                  Browse Stores
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="lg">
                  Open Your Store
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Subtle background decoration */}
        <div
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary-50 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary-50 blur-3xl"
          aria-hidden="true"
        />
      </section>

      {/* Category Browsing Section */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
              Browse by Category
            </h2>
            <p className="mt-2 text-secondary-600">
              Find exactly what you need from local stores
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {categories.map((cat) => (
              <Link
                key={cat.type + cat.label}
                href={`/search?type=${cat.type}`}
                className="group flex flex-col items-center gap-2 rounded-xl border border-secondary-200 bg-white p-4 text-center shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 transition-colors group-hover:bg-primary-100">
                  <cat.icon className="h-6 w-6 text-primary-600" />
                </div>
                <span className="text-xs font-medium text-secondary-700 sm:text-sm">
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Stores Section */}
      {stores.length > 0 && (
        <section className="bg-secondary-50 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
                Popular Stores
              </h2>
              <p className="mt-2 text-secondary-600">
                Explore neighborhood favorites near you
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link href="/search">
                <Button variant="outline" size="md">
                  View All Stores
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* How It Works Section */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-secondary-900 sm:text-3xl">
              How It Works
            </h2>
            <p className="mt-2 text-secondary-600">
              Shop local in three simple steps
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
                <Search className="h-7 w-7 text-primary-600" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-secondary-900">
                Find a Store
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-500">
                Search for local stores in your neighborhood and browse their
                product catalogs.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
                <ShoppingCart className="h-7 w-7 text-primary-600" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-secondary-900">
                Shop Local
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-500">
                Add items to your cart from your favorite stores and check out
                when ready.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
                <Package className="h-7 w-7 text-primary-600" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-secondary-900">
                Pick Up or Deliver
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-500">
                Choose pickup or delivery and get your order from your
                neighborhood store.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Store Owner CTA Section */}
      <section className="bg-primary-600 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Are you a store owner?
          </h2>
          <p className="mt-3 text-lg text-primary-100">
            Bring your store online with AI-powered tools. Manage inventory,
            process orders, and grow your business.
          </p>
          <div className="mt-8">
            <Link href="/register">
              <Button
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white hover:text-primary-700"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
