function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary-200 ${className ?? ''}`} />
}

export default function Loading() {
  return (
    <div className="flex h-screen flex-col">
      {/* Header skeleton */}
      <div className="border-b border-secondary-200 bg-white px-6 py-5 lg:px-8">
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8 space-y-8">
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-secondary-200 bg-white p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-7 w-16 mb-1.5" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Kanban skeleton */}
          <div>
            <Skeleton className="h-6 w-28 mb-2" />
            <Skeleton className="h-4 w-56 mb-5" />
            <div className="flex gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[240px] rounded-xl border border-t-4 border-t-secondary-300 bg-secondary-50/50 p-4">
                  <Skeleton className="h-5 w-20 mb-4" />
                  <div className="space-y-2.5">
                    <Skeleton className="h-24 w-full rounded-lg" />
                    {i < 2 && <Skeleton className="h-24 w-full rounded-lg" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
