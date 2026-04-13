import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  ChefHat,
  MapPin,
  Phone,
  StickyNote,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { OrderStatusBadge } from '@/components/ui/Badge'
import type { OrderStatus } from '@/types'

interface OrderDetailStore {
  id: string
  name: string
  slug: string | null
  phone: string | null
  street_address: string | null
  city: string | null
  state: string | null
  zipcode: string | null
}

interface OrderDetailItem {
  id: string
  order_id: string
  store_product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  created_at: Date
}

interface OrderDetail {
  id: string
  user_id: string
  store_id: string
  status: OrderStatus
  order_type: string
  subtotal: number
  tax: number
  delivery_fee: number
  total: number
  delivery_address: Record<string, string> | null
  customer_notes: string | null
  store_notes: string | null
  created_at: Date
  order_items: OrderDetailItem[]
  store: OrderDetailStore | null
}

const TIMELINE_STEPS: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: 'PENDING', label: 'Order Placed', icon: Clock },
  { status: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'PREPARING', label: 'Preparing', icon: ChefHat },
  { status: 'READY_FOR_PICKUP', label: 'Ready', icon: Package },
  { status: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
]

const STATUS_ORDER: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
]

function getStatusIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status)
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const order = await prisma.orders.findUnique({
    where: { id },
    include: {
      order_items: true,
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          street_address: true,
          city: true,
          state: true,
          zipcode: true,
        },
      },
    },
  })

  if (!order) {
    notFound()
  }

  const typedOrder: OrderDetail = {
    id: order.id,
    user_id: order.user_id,
    store_id: order.store_id,
    status: order.status as OrderStatus,
    order_type: order.order_type,
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    delivery_fee: Number(order.delivery_fee),
    total: Number(order.total),
    delivery_address: order.delivery_address as Record<string, string> | null,
    customer_notes: order.customer_notes,
    store_notes: order.store_notes,
    created_at: order.created_at,
    order_items: order.order_items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      store_product_id: item.store_product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
      created_at: item.created_at,
    })),
    store: order.store,
  }
  const currentIndex = getStatusIndex(typedOrder.status)
  const isCancelled = typedOrder.status === 'CANCELLED'

  // Determine timeline steps based on order type
  const steps =
    typedOrder.order_type === 'DELIVERY'
      ? [
          { status: 'PENDING' as OrderStatus, label: 'Order Placed', icon: Clock },
          { status: 'CONFIRMED' as OrderStatus, label: 'Confirmed', icon: CheckCircle2 },
          { status: 'PREPARING' as OrderStatus, label: 'Preparing', icon: ChefHat },
          { status: 'OUT_FOR_DELIVERY' as OrderStatus, label: 'Out for Delivery', icon: MapPin },
          { status: 'DELIVERED' as OrderStatus, label: 'Delivered', icon: CheckCircle2 },
        ]
      : TIMELINE_STEPS

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/orders"
        className="mb-6 inline-flex items-center gap-1 text-sm text-secondary-500 transition-colors hover:text-secondary-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All Orders
      </Link>

      {/* Order header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-secondary-900">
              Order #{typedOrder.id.slice(0, 8).toUpperCase()}
            </h1>
            <OrderStatusBadge status={typedOrder.status} />
          </div>
          <p className="mt-1 text-sm text-secondary-500">
            <Link
              href={
                typedOrder.store?.slug
                  ? `/store/${typedOrder.store.slug}`
                  : `/store/${typedOrder.store_id}`
              }
              className="font-medium text-secondary-700 hover:text-primary-600"
            >
              {typedOrder.store?.name ?? 'Store'}
            </Link>{' '}
            &middot; {formatDate(typedOrder.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Status timeline */}
        {!isCancelled && (
          <Card>
            <h2 className="mb-6 font-semibold text-secondary-900">
              Order Progress
            </h2>
            <div className="flex items-start justify-between">
              {steps.map((step, index) => {
                const stepIndex = getStatusIndex(step.status)
                const isCompleted = stepIndex < currentIndex
                const isCurrent = stepIndex === currentIndex
                const isFuture = stepIndex > currentIndex
                const StepIcon = step.icon
                const isLast = index === steps.length - 1

                return (
                  <div
                    key={step.status}
                    className="flex flex-1 flex-col items-center"
                  >
                    <div className="flex w-full items-center">
                      {/* Line before (except first) */}
                      {index > 0 && (
                        <div
                          className={cn(
                            'h-0.5 flex-1',
                            isCompleted || isCurrent
                              ? 'bg-primary-500'
                              : 'bg-secondary-200',
                          )}
                        />
                      )}

                      {/* Icon circle */}
                      <div
                        className={cn(
                          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                          isCompleted &&
                            'border-primary-500 bg-primary-500 text-white',
                          isCurrent &&
                            'border-amber-500 bg-amber-50 text-amber-600',
                          isFuture &&
                            'border-secondary-200 bg-secondary-50 text-secondary-400',
                        )}
                      >
                        {isCurrent && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-20" />
                        )}
                        <StepIcon className="relative h-4 w-4" />
                      </div>

                      {/* Line after (except last) */}
                      {!isLast && (
                        <div
                          className={cn(
                            'h-0.5 flex-1',
                            isCompleted && stepIndex + 1 <= currentIndex
                              ? 'bg-primary-500'
                              : 'bg-secondary-200',
                          )}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <p
                      className={cn(
                        'mt-2 text-center text-xs font-medium',
                        isCompleted && 'text-primary-700',
                        isCurrent && 'text-amber-700',
                        isFuture && 'text-secondary-400',
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="rounded-xl bg-red-50 px-6 py-4 text-center">
            <p className="font-medium text-red-700">
              This order has been cancelled.
            </p>
          </div>
        )}

        {/* Items list */}
        <Card padding="none">
          <div className="border-b border-secondary-200 px-6 py-4">
            <h2 className="font-semibold text-secondary-900">Items</h2>
          </div>
          <div className="divide-y divide-secondary-100">
            {typedOrder.order_items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-secondary-900">
                    {item.product_name}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {formatPrice(item.unit_price)} x {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-medium text-secondary-900">
                  {formatPrice(item.total_price)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-secondary-200 px-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary-500">Subtotal</span>
                <span className="text-secondary-900">
                  {formatPrice(typedOrder.subtotal)}
                </span>
              </div>
              {typedOrder.delivery_fee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-500">Delivery Fee</span>
                  <span className="text-secondary-900">
                    {formatPrice(typedOrder.delivery_fee)}
                  </span>
                </div>
              )}
              {typedOrder.tax > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary-500">Tax</span>
                  <span className="text-secondary-900">
                    {formatPrice(typedOrder.tax)}
                  </span>
                </div>
              )}
              <div className="border-t border-secondary-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-secondary-900">
                    Total
                  </span>
                  <span className="text-lg font-bold text-secondary-900">
                    {formatPrice(typedOrder.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Customer notes */}
        {typedOrder.customer_notes && (
          <Card>
            <h2 className="mb-2 flex items-center gap-2 font-semibold text-secondary-900">
              <StickyNote className="h-4 w-4 text-secondary-400" />
              Your Notes
            </h2>
            <p className="text-sm text-secondary-600">
              {typedOrder.customer_notes}
            </p>
          </Card>
        )}

        {/* Store contact info */}
        {typedOrder.store && (
          <Card>
            <h2 className="mb-3 font-semibold text-secondary-900">
              Store Info
            </h2>
            <div className="space-y-2">
              <Link
                href={
                  typedOrder.store.slug
                    ? `/store/${typedOrder.store.slug}`
                    : `/store/${typedOrder.store.id}`
                }
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {typedOrder.store.name}
              </Link>
              {typedOrder.store.phone && (
                <div className="flex items-center gap-2 text-sm text-secondary-600">
                  <Phone className="h-4 w-4 text-secondary-400" />
                  <a
                    href={`tel:${typedOrder.store.phone}`}
                    className="hover:text-primary-600"
                  >
                    {typedOrder.store.phone}
                  </a>
                </div>
              )}
              {typedOrder.store.street_address && (
                <div className="flex items-center gap-2 text-sm text-secondary-600">
                  <MapPin className="h-4 w-4 text-secondary-400" />
                  <span>
                    {typedOrder.store.street_address}
                    {typedOrder.store.city
                      ? `, ${typedOrder.store.city}`
                      : ''}
                    {typedOrder.store.state
                      ? `, ${typedOrder.store.state}`
                      : ''}
                    {typedOrder.store.zipcode
                      ? ` ${typedOrder.store.zipcode}`
                      : ''}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
