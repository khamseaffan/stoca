const DOCUMENT_EXTENSIONS = [
  '.html',
  '.htm',
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.pdf',
]

/** Reject obvious web pages before passing URLs to img/next-image. */
export function isRenderableImageUrl(url: string | null | undefined) {
  if (!url) return false

  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('data:image/')) return true

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:', 'blob:'].includes(parsed.protocol)) return false

    const pathname = parsed.pathname.toLowerCase()
    return !DOCUMENT_EXTENSIONS.some((extension) => pathname.endsWith(extension))
  } catch {
    return false
  }
}

export function firstRenderableImageUrl(urls: string[] | null | undefined) {
  return urls?.find(isRenderableImageUrl) ?? null
}
