import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="rounded-full bg-secondary-100 p-3">
        <Icon className="h-6 w-6 text-secondary-400" />
      </div>
      <h3 className="mt-4 font-medium text-secondary-900">{title}</h3>
      <p className="mt-1 text-center text-sm text-secondary-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
