'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="rounded-full bg-red-100 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-xl font-semibold text-secondary-900 mb-2">Something went wrong</h2>
      <p className="text-secondary-500 text-sm mb-6">{error.message}</p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
