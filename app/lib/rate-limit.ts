const requests = new Map<string, number[]>()

const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs
  for (const [key, timestamps] of requests) {
    const valid = timestamps.filter(t => t > cutoff)
    if (valid.length === 0) requests.delete(key)
    else requests.set(key, valid)
  }
}

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  cleanup(windowMs)
  const now = Date.now()
  const cutoff = now - windowMs
  const timestamps = (requests.get(key) ?? []).filter(t => t > cutoff)

  if (timestamps.length >= maxRequests) return false

  timestamps.push(now)
  requests.set(key, timestamps)
  return true
}
