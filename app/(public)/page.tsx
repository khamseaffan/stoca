import Link from 'next/link'
import { Search, ShoppingCart, Package } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/Button'
import { StoreCard } from '@/components/commerce/StoreCard'
import type { StoreType } from '@/types'

export default async function HomePage() {
  const storeData = await prisma.stores.findMany({
    where: { is_active: true },
    take: 6,
    select: { id: true, name: true, slug: true, store_type: true, city: true, state: true, logo_url: true },
  })

  const stores = storeData.map((s) => ({
    ...s,
    store_type: s.store_type as StoreType,
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

            {/* Search Bar */}
            <form
              action="/search"
              method="GET"
              className="mx-auto mt-10 max-w-xl"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search stores and products..."
                  className="w-full rounded-full border border-secondary-300 bg-white py-3.5 pl-12 pr-4 text-base text-secondary-900 placeholder:text-secondary-400 shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </form>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
