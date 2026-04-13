import { clsx, type ClassValue } from 'clsx'

/** Merge Tailwind class names conditionally. Wrapper around clsx. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Format a number as USD currency (e.g., 4.99 → "$4.99"). */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

/** Format a date as "Apr 10, 3:45 PM". Accepts ISO string or Date object. */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

/** Extract up to 2 initials from a name (e.g., "Sarah Chen" → "SC"). */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Convert text to a URL-safe slug (e.g., "Fresh Market" → "fresh-market"). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
