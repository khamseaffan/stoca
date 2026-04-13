import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const paddingStyles = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const

export interface CardProps {
  children: ReactNode
  className?: string
  padding?: keyof typeof paddingStyles
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-secondary-200 bg-white shadow-sm',
        paddingStyles[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
