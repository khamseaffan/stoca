import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'

const variantStyles = {
  default: 'bg-secondary-100 text-secondary-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
} as const

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
} as const

export interface BadgeProps {
  variant?: keyof typeof variantStyles
  size?: keyof typeof sizeStyles
  children: ReactNode
  className?: string
}

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {children}
    </span>
  )
}

const orderStatusMap: Record<OrderStatus, { variant: BadgeProps['variant']; label: string }> = {
  PENDING: { variant: 'info', label: 'Pending' },
  CONFIRMED: { variant: 'info', label: 'Confirmed' },
  PREPARING: { variant: 'warning', label: 'Preparing' },
  READY_FOR_PICKUP: { variant: 'success', label: 'Ready for Pickup' },
  OUT_FOR_DELIVERY: { variant: 'success', label: 'Out for Delivery' },
  DELIVERED: { variant: 'success', label: 'Delivered' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  CANCELLED: { variant: 'danger', label: 'Cancelled' },
}

export interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = orderStatusMap[status]

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}
