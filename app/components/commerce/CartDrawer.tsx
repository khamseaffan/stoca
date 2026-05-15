'use client'

import { useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Plus, Minus, Trash2, ShoppingBag, Package } from 'lucide-react'
import { firstRenderableImageUrl } from '@/lib/images'
import { cn, formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { CartWithItems } from '@/types'

export interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CartWithItems[]
  onUpdateQuantity: (itemId: string, qty: number) => void
  onRemoveItem: (itemId: string) => void
}

interface GroupedItems {
  store: CartWithItems['store']
  items: CartWithItems[]
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
}: CartDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKey)
    }
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const grouped = useMemo<GroupedItems[]>(() => {
    const map = new Map<string, GroupedItems>()
    for (const item of items) {
      const existing = map.get(item.store.id)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(item.store.id, { store: item.store, items: [item] })
      }
    }
    return Array.from(map.values())
  }, [items])

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce(
    (sum, item) => sum + item.captured_price * item.quantity,
    0,
  )

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-secondary-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-secondary-900">
              Your Cart
            </h2>
            {totalCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-medium text-white">
                {totalCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700 transition-colors"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-100">
              <ShoppingBag className="h-8 w-8 text-secondary-400" />
            </div>
            <p className="text-base font-medium text-secondary-700">
              Your cart is empty
            </p>
            <p className="text-sm text-secondary-500">
              Browse stores and add items to get started.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {grouped.map((group) => (
              <div key={group.store.id} className="mb-6 last:mb-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary-500">
                  {group.store.name}
                </h3>
                <div className="space-y-4">
                  {group.items.map((item) => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onUpdateQuantity={onUpdateQuantity}
                      onRemoveItem={onRemoveItem}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-secondary-200 px-6 py-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-secondary-600">
                Subtotal
              </span>
              <span className="text-lg font-semibold text-secondary-900">
                {formatPrice(subtotal)}
              </span>
            </div>
            <Link href="/checkout" onClick={onClose}>
              <Button variant="primary" size="lg" className="w-full">
                Checkout
              </Button>
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Cart Item Row                                                      */
/* ------------------------------------------------------------------ */

interface CartItemRowProps {
  item: CartWithItems
  onUpdateQuantity: (itemId: string, qty: number) => void
  onRemoveItem: (itemId: string) => void
}

function CartItemRow({ item, onUpdateQuantity, onRemoveItem }: CartItemRowProps) {
  const product = item.store_product
  const lineTotal = item.captured_price * item.quantity
  const imageUrl = firstRenderableImageUrl(product.image_urls)

  return (
    <div className="flex gap-3">
      {/* Image */}
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-secondary-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-6 w-6 text-secondary-300" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm font-medium text-secondary-900">
          {product.name}
        </p>
        <p className="text-xs text-secondary-500">
          {formatPrice(item.captured_price)} each
        </p>

        <div className="mt-auto flex items-center justify-between pt-1">
          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-secondary-200 text-secondary-600 transition-colors hover:bg-secondary-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-7 w-8 items-center justify-center text-sm font-medium text-secondary-900">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-secondary-200 text-secondary-600 transition-colors hover:bg-secondary-100"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Line total + remove */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-secondary-900">
              {formatPrice(lineTotal)}
            </span>
            <button
              onClick={() => onRemoveItem(item.id)}
              className="rounded-md p-1 text-secondary-400 transition-colors hover:bg-red-50 hover:text-red-500"
              aria-label={`Remove ${product.name} from cart`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
