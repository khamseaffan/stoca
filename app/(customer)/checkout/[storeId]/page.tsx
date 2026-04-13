'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  ShoppingBag,
  ArrowLeft,
  StickyNote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { CartWithItems, Store, OrderType } from '@/types'

export default function CheckoutPage() {
  const params = useParams<{ storeId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<CartWithItems[]>([])
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Order configuration
  const [orderType, setOrderType] = useState<OrderType>('PICKUP')
  const [customerNotes, setCustomerNotes] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: '',
    zip: '',
  })

  // Success state
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const [cartResult, storeResult] = await Promise.all([
        supabase
          .from('cart_items')
          .select(
            '*, store_product:store_products(*), store:stores(id, name, slug)',
          )
          .eq('user_id', user.id)
          .eq('store_id', params.storeId)
          .order('created_at', { ascending: true }),
        supabase
          .from('stores')
          .select('*')
          .eq('id', params.storeId)
          .single(),
      ])

      if (cartResult.error || !cartResult.data?.length) {
        router.push('/cart')
        return
      }

      setItems(cartResult.data as unknown as CartWithItems[])
      setStore(storeResult.data as Store | null)

      // Default to pickup if delivery is not enabled
      if (storeResult.data && !storeResult.data.delivery_enabled) {
        setOrderType('PICKUP')
      }

      setLoading(false)
    }

    fetchData()
  }, [supabase, params.storeId, router])

  const subtotal = items.reduce(
    (sum, item) => sum + item.captured_price * item.quantity,
    0,
  )
  const deliveryFee =
    orderType === 'DELIVERY' && store?.delivery_enabled
      ? store.delivery_fee
      : 0
  const total = subtotal + deliveryFee

  async function handlePlaceOrder() {
    setError(null)
    setPlacing(true)

    const address =
      orderType === 'DELIVERY'
        ? {
            street: deliveryAddress.street,
            city: deliveryAddress.city,
            zip: deliveryAddress.zip,
          }
        : null

    const { data, error: rpcError } = await supabase.rpc(
      'create_order_from_cart',
      {
        p_store_id: params.storeId,
        p_order_type: orderType,
        p_delivery_address: address,
        p_customer_notes: customerNotes || null,
      },
    )

    if (rpcError) {
      setError(rpcError.message || 'Failed to place order. Please try again.')
      setPlacing(false)
      return
    }

    setOrderId(data as string)
    setPlacing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Success screen
  if (orderId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100">
            <CheckCircle2 className="h-10 w-10 text-primary-600" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-secondary-900">
            Order Placed!
          </h1>
          <p className="mt-2 text-secondary-500">
            Your order has been sent to{' '}
            <span className="font-medium text-secondary-700">
              {store?.name}
            </span>
            . You will be notified when it is ready.
          </p>
          <p className="mt-4 rounded-lg bg-secondary-100 px-4 py-2 text-sm font-mono text-secondary-600">
            Order #{orderId.slice(0, 8).toUpperCase()}
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link href={`/orders/${orderId}`}>
              <Button>View Order</Button>
            </Link>
            <Link href="/">
              <Button variant="secondary">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const canDeliver = store?.delivery_enabled ?? false
  const deliveryValid =
    orderType === 'PICKUP' ||
    (deliveryAddress.street.trim() !== '' &&
      deliveryAddress.city.trim() !== '' &&
      deliveryAddress.zip.trim() !== '')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/cart"
        className="mb-6 inline-flex items-center gap-1 text-sm text-secondary-500 transition-colors hover:text-secondary-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cart
      </Link>

      <h1 className="text-2xl font-bold text-secondary-900">Checkout</h1>
      <p className="mt-1 text-sm text-secondary-500">
        Ordering from{' '}
        <span className="font-medium text-secondary-700">{store?.name}</span>
      </p>

      <div className="mt-6 space-y-6">
        {/* Order summary */}
        <Card padding="none">
          <div className="border-b border-secondary-200 px-6 py-4">
            <h2 className="font-semibold text-secondary-900">Order Summary</h2>
          </div>
          <div className="divide-y divide-secondary-100">
            {items.map((item) => {
              const product = item.store_product
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-100">
                      <ShoppingBag className="h-4 w-4 text-secondary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {formatPrice(item.captured_price)} x {item.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-secondary-900">
                    {formatPrice(item.captured_price * item.quantity)}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Order type selection */}
        <Card>
          <h2 className="mb-4 font-semibold text-secondary-900">
            Order Type
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Pickup card */}
            <button
              type="button"
              onClick={() => setOrderType('PICKUP')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all',
                orderType === 'PICKUP'
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/20'
                  : 'border-secondary-200 hover:border-secondary-300',
              )}
            >
              <Package
                className={cn(
                  'h-6 w-6',
                  orderType === 'PICKUP'
                    ? 'text-primary-600'
                    : 'text-secondary-400',
                )}
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  orderType === 'PICKUP'
                    ? 'text-primary-700'
                    : 'text-secondary-700',
                )}
              >
                Pickup
              </span>
              <span className="text-xs text-secondary-500">
                Pick up at store
              </span>
            </button>

            {/* Delivery card */}
            <button
              type="button"
              onClick={() => canDeliver && setOrderType('DELIVERY')}
              disabled={!canDeliver}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all',
                !canDeliver && 'cursor-not-allowed opacity-50',
                orderType === 'DELIVERY'
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/20'
                  : 'border-secondary-200 hover:border-secondary-300',
              )}
            >
              <Truck
                className={cn(
                  'h-6 w-6',
                  orderType === 'DELIVERY'
                    ? 'text-primary-600'
                    : 'text-secondary-400',
                )}
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  orderType === 'DELIVERY'
                    ? 'text-primary-700'
                    : 'text-secondary-700',
                )}
              >
                Delivery
              </span>
              <span className="text-xs text-secondary-500">
                {canDeliver
                  ? `${formatPrice(store?.delivery_fee ?? 0)} fee`
                  : 'Not available'}
              </span>
            </button>
          </div>
        </Card>

        {/* Delivery address form */}
        {orderType === 'DELIVERY' && canDeliver && (
          <Card>
            <h2 className="mb-4 font-semibold text-secondary-900">
              <MapPin className="mr-2 inline h-4 w-4 text-secondary-400" />
              Delivery Address
            </h2>
            <div className="space-y-4">
              <Input
                label="Street Address"
                placeholder="123 Main St, Apt 4"
                value={deliveryAddress.street}
                onChange={(e) =>
                  setDeliveryAddress((prev) => ({
                    ...prev,
                    street: e.target.value,
                  }))
                }
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City"
                  placeholder="New York"
                  value={deliveryAddress.city}
                  onChange={(e) =>
                    setDeliveryAddress((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="ZIP Code"
                  placeholder="10001"
                  value={deliveryAddress.zip}
                  onChange={(e) =>
                    setDeliveryAddress((prev) => ({
                      ...prev,
                      zip: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
          </Card>
        )}

        {/* Customer notes */}
        <Card>
          <h2 className="mb-4 font-semibold text-secondary-900">
            <StickyNote className="mr-2 inline h-4 w-4 text-secondary-400" />
            Notes{' '}
            <span className="font-normal text-secondary-400">(optional)</span>
          </h2>
          <textarea
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            placeholder="Any special requests or instructions..."
            rows={3}
            maxLength={2000}
            className="block w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </Card>

        {/* Totals + Place Order */}
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-secondary-500">Subtotal</span>
              <span className="text-secondary-900">{formatPrice(subtotal)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary-500">Delivery Fee</span>
                <span className="text-secondary-900">
                  {formatPrice(deliveryFee)}
                </span>
              </div>
            )}
            <div className="border-t border-secondary-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-secondary-900">Total</span>
                <span className="text-lg font-bold text-secondary-900">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            loading={placing}
            disabled={!deliveryValid}
            onClick={handlePlaceOrder}
          >
            Place Order
          </Button>

          {!deliveryValid && (
            <p className="mt-2 text-center text-xs text-secondary-500">
              Please fill in your delivery address to continue.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
