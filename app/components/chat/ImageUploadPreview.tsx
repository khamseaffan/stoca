'use client'

import { Camera, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploadPreviewProps {
  imageUrl: string
  fileName: string
  onRemove: () => void
  onScan: () => void
  className?: string
}

export function ImageUploadPreview({
  imageUrl,
  fileName,
  onRemove,
  onScan,
  className,
}: ImageUploadPreviewProps) {
  const truncatedName =
    fileName.length > 24 ? fileName.slice(0, 21) + '...' : fileName

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 bg-secondary-50 rounded-lg border border-secondary-200 mx-4 mb-2',
        'chat-slide-up',
        className,
      )}
    >
      {/* Thumbnail */}
      <img
        src={imageUrl}
        alt="Upload preview"
        className="h-10 w-10 rounded object-cover shrink-0 border border-secondary-200"
      />

      {/* File name */}
      <span className="text-sm text-secondary-600 truncate flex-1" title={fileName}>
        {truncatedName}
      </span>

      {/* Scan button */}
      <button
        type="button"
        onClick={onScan}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
          'bg-primary-600 text-white hover:bg-primary-700',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
        )}
      >
        <Camera className="h-3.5 w-3.5" />
        Scan Inventory
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'inline-flex items-center justify-center rounded-lg p-1.5',
          'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-secondary-400 focus:ring-offset-1',
        )}
        aria-label="Remove image"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
