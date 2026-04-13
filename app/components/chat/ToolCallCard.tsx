'use client'

import { useState } from 'react'
import {
  DollarSign, Package, ShoppingCart, Store, Tag, BarChart3,
  Search, Camera, Wrench, ChevronDown, ChevronRight, Loader2,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolPart {
  type: string
  toolCallId: string
  toolName?: string
  state: string
  input?: unknown
  output?: unknown
  errorText?: string
}

interface ToolCallCardProps {
  toolPart: ToolPart
}

function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase()
  if (name.includes('price')) return DollarSign
  if (name.includes('product') || name.includes('add') || name.includes('remove') || name.includes('stock')) return Package
  if (name.includes('order') || name.includes('status')) return ShoppingCart
  if (name.includes('store') || name.includes('hours') || name.includes('info')) return Store
  if (name.includes('promotion')) return Tag
  if (name.includes('analytics') || name.includes('sales') || name.includes('top')) return BarChart3
  if (name.includes('search')) return Search
  if (name.includes('inventory') || name.includes('image')) return Camera
  return Wrench
}

function formatToolName(toolName: string): string {
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getResultSummary(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return 'Done'
  const r = result as Record<string, unknown>
  const name = toolName.toLowerCase()
  if (r.error) return `Error: ${r.error}`
  if (name.includes('price') && r.new_price != null) return `Price updated to $${Number(r.new_price).toFixed(2)}`
  if (name.includes('search') && Array.isArray(r.products)) return `${r.products.length} product${r.products.length === 1 ? '' : 's'} found`
  if (name.includes('stock') && r.quantity != null) return `Stock updated to ${r.quantity} units`
  if (name.includes('add') && r.product_name) return `Added "${r.product_name}"`
  if (name.includes('remove') && r.product_name) return `Removed "${r.product_name}"`
  if (name.includes('order') && r.status) return `Order status: ${r.status}`
  if (name.includes('orders') && Array.isArray(r.orders)) return `${r.orders.length} recent order${r.orders.length === 1 ? '' : 's'}`
  if (name.includes('sales') && r.total_revenue != null) return `Revenue: $${Number(r.total_revenue).toFixed(2)}`
  if (name.includes('top') && Array.isArray(r.products)) return `Top ${r.products.length} product${r.products.length === 1 ? '' : 's'}`
  if (name.includes('low_stock') && Array.isArray(r.alerts)) return `${r.alerts.length} low stock alert${r.alerts.length === 1 ? '' : 's'}`
  if (name.includes('promotion') && r.code) return `Created promo: ${r.code}`
  if (name.includes('inventory') || name.includes('image')) {
    if (Array.isArray(r.products)) return `Identified ${r.products.length} product${r.products.length === 1 ? '' : 's'}`
  }
  if (name.includes('hours')) return 'Store hours updated'
  if (name.includes('info')) return 'Store info updated'
  if (r.message && typeof r.message === 'string') return r.message
  if (r.success) return 'Completed successfully'
  return 'Done'
}

export function ToolCallCard({ toolPart }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  // Derive tool name from the part type or toolName field
  const toolName = toolPart.toolName ?? toolPart.type.replace(/^tool-/, '')
  const isLoading = toolPart.state === 'input-streaming' || toolPart.state === 'input-available'
  const hasOutput = toolPart.state === 'output-available'
  const hasError = toolPart.state === 'output-error'
  const isError: boolean = hasError || !!(hasOutput && toolPart.output && typeof toolPart.output === 'object' && 'error' in (toolPart.output as Record<string, unknown>))
  const hasResult = hasOutput || hasError

  const Icon = getToolIcon(toolName)

  const borderColor = isLoading
    ? 'border-l-amber-400'
    : isError
      ? 'border-l-red-500'
      : 'border-l-green-500'

  return (
    <div className={cn('rounded-lg border border-secondary-200 bg-secondary-50/50 px-3 py-2 mt-2 text-sm border-l-[3px] transition-all duration-200', borderColor)}>
      <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => hasResult && setExpanded(!expanded)}>
        <Icon className="h-3.5 w-3.5 shrink-0 text-secondary-500" />
        <span className="font-medium text-secondary-700 flex-1 truncate">{formatToolName(toolName)}</span>

        {isLoading && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running...
          </span>
        )}
        {hasResult && !isError && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            {getResultSummary(toolName, toolPart.output)}
          </span>
        )}
        {hasResult && isError && (
          <span className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {String(toolPart.errorText ?? getResultSummary(toolName, toolPart.output))}
          </span>
        )}
        {hasResult && (
          <button type="button" className="shrink-0 text-secondary-400 hover:text-secondary-600 transition-colors">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {expanded && hasResult && (
        <div className="mt-2 pt-2 border-t border-secondary-200">
          {toolPart.input != null && (
            <div className="mb-2">
              <p className="text-xs font-medium text-secondary-500 mb-1">Arguments</p>
              <pre className="text-xs text-secondary-600 bg-white rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(toolPart.input, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-secondary-500 mb-1">Result</p>
            <pre className="text-xs text-secondary-600 bg-white rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(toolPart.output ?? toolPart.errorText, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
