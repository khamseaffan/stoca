'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { CartWithItems } from '@/types'

interface StoreGroup {
  storeId: string
  storeName: string
  storeSlug: string | null
  items: CartWithItems[]
  subtotal: number
}

export default function CartPage() {
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const fetchCart = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('cart_items')
      .select(
        '*, store_product:store_products(*), store:stores(id, name, slug)',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch cart:', error)
      setLoading(false)
      return
    }

    const items = (data ?? []) as unknown as CartWithItems[]

    const grouped = items.reduce<Record<string, StoreGroup>>((acc, item) => {
      const sid = item.store_id
      if (!acc[sid]) {
        acc[sid] = {
          storeId: sid,
          storeName: item.store?.name ?? 'Unknown Store',
          storeSlug: item.store?.slug ?? null,
          items: [],
          subtotal: 0,
        }
      }
      acc[sid].items.push(item)
      acc[sid].subtotal += item.captured_price * item.quantity
      return acc
    }, {})

    setStoreGroups(Object.values(grouped))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  async function updateQuantity(itemId: string, newQuantity: number) {
    if (newQuantity < 1) return
    setUpdatingIds((prev) => new Set(prev).add(itemId))

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('id', itemId)

    if (!error) {
      setStoreGroups((prev) =>
        prev.map((group) => {
          const updated = group.items.map((item) =>
            item.id === itemId ? { ...item, quantity: newQuantity } : item,
          )
          return {
            ...group,
            items: updated,
            subtotal: updated.reduce(
              (sum, item) => sum + item.captured_price * item.quantity,
              0,
            ),
          }
        }),
      )
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  async function removeItem(itemId: string, storeId: string) {
    setUpdatingIds((prev) => new Set(prev).add(itemId))

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)

    if (!error) {
      setStoreGroups((prev) => {
        const updated = prev
          .map((group) => {
            if (group.storeId !== storeId) return group
            const items = group.items.filter((item) => item.id !== itemId)
            return {
              ...group,
              items,
              subtotal: items.reduce(
                (sum, item) => sum + item.captured_price * item.quantity,
                0,
              ),
            }
          })
          .filter((group) => group.items.length > 0)
        return updated
      })
    }

    setUpdatingIds((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  const grandTotal = storeGroups.reduce(
    (sum, group) => sum + group.subtotal,
    0,
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (storeGroups.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse stores and add products to get started."
          action={
            <Link href="/">
              <Button>Browse Stores</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-secondary-900">Shopping Cart</h1>
      <p className="mt-1 text-sm text-secondary-500">
        {storeGroups.reduce((sum, g) => sum + g.items.length, 0)} item
        {storeGroups.reduce((sum, g) => sum + g.items.length, 0) !== 1
          ? 's'
          : ''}{' '}
        from {storeGroups.length} store
        {storeGroups.length !== 1 ? 's' : ''}
      </p>

      <div className="mt-6 space-y-6">
        {storeGroups.map((group) => (
          <Card key={group.storeId} padding="none">
            {/* Store header */}
            <div className="flex items-center gap-3 border-b border-secondary-200 px-6 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                <Store className="h-4 w-4 text-primary-600" />
              </div>
              <Link
                href={
                  group.storeSlug
                    ? `/store/${group.storeSlug}`
                    : `/store/${group.storeId}`
                }
                className="font-semibold text-secondary-900 transition-colors hover:text-primary-600"
              >
                {group.storeName}
              </Link>
            </div>

            {/* Items */}
            <div className="divide-y divide-secondary-100">
              {group.items.map((item) => {
                const product = item.store_product
                const imageUrl =
                  product.image_urls && product.image_urls.length > 0
                    ? product.image_urls[0]
                    : null
                const lineTotal = item.captured_price * item.quantity
                const isUpdating = updatingIds.has(item.id)

                return (
                  <div
                    key={item.id}
                    className="flex gap-4 px-6 py-4"
                  >
                    {/* Image */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary-100">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={product.name}
                          width={80}
                          height={80}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-secondary-300" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-secondary-900">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-sm text-secondary-500">
                          {formatPrice(item.captured_price)} each
                        </p>
                      </div>

                      {/* Quantity controls */}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1 || isUpdating}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-secondary-300 text-secondary-600 transition-colors hover:bg-secondary-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-medium text-secondary-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={isUpdating}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-secondary-300 text-secondary-600 transition-colors hover:bg-secondary-50 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id, group.storeId)}
                          disabled={isUpdating}
                          className="ml-2 flex items-center gap-1 text-sm text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
                          aria-label={`Remove ${product.name} from cart`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-secondary-900">
                        {formatPrice(lineTotal)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Store subtotal + checkout button */}
            <div className="flex items-center justify-between border-t border-secondary-200 px-6 py-4">
              <div>
                <span className="text-sm text-secondary-500">Subtotal</span>
                <span className="ml-2 text-base font-semibold text-secondary-900">
                  {formatPrice(group.subtotal)}
                </span>
              </div>
              <Link href={`/checkout/${group.storeId}`}>
                <Button size="sm">
                  Checkout
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Grand total */}
      {storeGroups.length > 1 && (
        <div className="mt-6 flex items-center justify-between rounded-xl bg-secondary-100 px-6 py-4">
          <span className="font-medium text-secondary-700">Grand Total</span>
          <span className="text-xl font-bold text-secondary-900">
            {formatPrice(grandTotal)}
          </span>
        </div>
      )}
    </div>
  )
}
