'use client'

import { useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: keyof typeof sizeStyles
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className={cn(
          'relative w-full rounded-xl bg-white shadow-xl transition-opacity',
          sizeStyles[size],
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-secondary-200 px-6 py-4">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-secondary-900"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-secondary-600"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={cn(title ? 'px-6 py-4' : 'p-6')}>
          {children}
        </div>

        {/* Close button when no title */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-secondary-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
