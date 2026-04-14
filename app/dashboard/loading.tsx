function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-secondary-200 ${className ?? ''}`} />
}

export default function Loading() {
  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header skeleton */}
        <div className="border-b border-secondary-200 bg-white px-6 py-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-secondary-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-6 w-16 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Kanban columns skeleton */}
          <div>
            <Skeleton className="h-6 w-28 mb-4" />
            <div className="flex gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[200px] rounded-xl border border-t-4 border-t-secondary-300 bg-secondary-50/50 p-3">
                  <Skeleton className="h-5 w-20 mb-3" />
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chat panel skeleton */}
      <div className="hidden w-[35%] min-w-[360px] border-l border-secondary-200 lg:block">
        <div className="flex items-center gap-3 border-b border-secondary-200 bg-white px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}
