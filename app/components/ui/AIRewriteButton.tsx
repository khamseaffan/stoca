'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIRewriteButtonProps {
  context: {
    name: string
    price?: number
    category?: string
    currentText?: string
  }
  onResult: (text: string) => void
  className?: string
}

export function AIRewriteButton({ context, onResult, className }: AIRewriteButtonProps) {
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const handleClick = useCallback(async () => {
    if (loading || cooldown) return

    setLoading(true)
    try {
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: context.name || 'My Store',
          price: context.price,
          category: context.category,
          currentText: context.currentText,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        onResult(data.description)
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setLoading(false)
      setCooldown(true)
      setTimeout(() => setCooldown(false), 10000)
    }
  }, [context, loading, cooldown, onResult])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || cooldown}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200',
        'border border-primary-200 bg-primary-50 text-primary-700',
        'hover:bg-primary-100 hover:border-primary-300',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {loading ? 'Writing...' : cooldown ? 'Wait...' : 'Rewrite with AI'}
    </button>
  )
}
