function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary-200 ${className ?? ''}`} />
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Store header skeleton */}
      <div className="bg-white border-b border-secondary-200">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex items-start gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-96 max-w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products grid skeleton */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Category tabs */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-secondary-200 bg-white overflow-hidden">
              <Skeleton className="h-40 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
