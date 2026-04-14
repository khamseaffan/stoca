'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import {
  Bot, SendHorizontal, Camera, AlertCircle, RefreshCw,
  Trash2, Download, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessage } from './ChatMessage'
import { ImageUploadPreview } from './ImageUploadPreview'

interface ChatWindowProps {
  storeId: string
  storeName: string
  className?: string
}

const STORAGE_KEY_PREFIX = 'stoca-chat-'
const MAX_MESSAGES_WARNING = 50
const MAX_MESSAGES_HARD_LIMIT = 100

function loadMessages(storeId: string): UIMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${storeId}`)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveMessages(storeId: string, messages: UIMessage[]) {
  if (typeof window === 'undefined') return
  try {
    if (messages.length === 0) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${storeId}`)
    } else {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${storeId}`, JSON.stringify(messages))
    }
  } catch {
    // localStorage full — silently ignore
  }
}

function exportChat(messages: UIMessage[], storeName: string) {
  const lines = messages.map((m) => {
    const role = m.role === 'user' ? 'You' : 'AI Assistant'
    const text = (m.parts ?? [])
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('')
    return `[${role}]\n${text}\n`
  })

  const content = `Chat Export — ${storeName}\n${'='.repeat(40)}\n\n${lines.join('\n')}`
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stoca-chat-${storeName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export function ChatWindow({ storeId, storeName, className }: ChatWindowProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [hydrated, setHydrated] = useState(false)

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/ai/chat', body: { storeId } }),
    [storeId],
  )

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: `store-${storeId}`,
    transport,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Restore messages from localStorage after hydration (client-only)
  useEffect(() => {
    const saved = loadMessages(storeId)
    if (saved.length > 0) {
      setMessages(saved)
    }
    setHydrated(true)
  }, [storeId, setMessages])

  // Persist messages to localStorage on change (only after hydration)
  useEffect(() => {
    if (!hydrated) return
    saveMessages(storeId, messages)
  }, [messages, storeId, hydrated])

  // Auto-focus chat input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Cleanup object URL on unmount or image change
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const handleClearChat = useCallback(() => {
    setMessages([])
    saveMessages(storeId, [])
    setShowClearConfirm(false)
    inputRef.current?.focus()
  }, [storeId, setMessages])

  const handleExport = useCallback(() => {
    exportChat(messages, storeName)
  }, [messages, storeName])

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setSelectedImage(file)
      setImagePreview(URL.createObjectURL(file))
      e.target.value = ''
    },
    [imagePreview],
  )

  const clearImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setSelectedImage(null)
    setImagePreview(null)
  }, [imagePreview])

  const handleScan = useCallback(() => {
    if (!selectedImage) return
    setInputValue('Scan this inventory image and identify the products')
    setTimeout(() => {
      const form = document.getElementById('chat-form') as HTMLFormElement
      if (form) form.requestSubmit()
    }, 0)
  }, [selectedImage])

  const onFormSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const text = inputValue.trim()
      if (!text && !selectedImage) return

      await sendMessage({ text: text || 'Scan this inventory image' })
      setInputValue('')
      clearImage()
      inputRef.current?.focus()
    },
    [inputValue, selectedImage, sendMessage, clearImage],
  )

  const isTyping =
    isLoading &&
    (messages.length === 0 || messages[messages.length - 1]?.role === 'user')

  const canSend = (inputValue.trim().length > 0 || selectedImage !== null) && !isLoading
  const isNearLimit = messages.length >= MAX_MESSAGES_WARNING
  const isAtLimit = messages.length >= MAX_MESSAGES_HARD_LIMIT

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-secondary-50/50 rounded-xl border border-secondary-200 overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-secondary-200 bg-white px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100">
          <Bot className="h-5 w-5 text-primary-700" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-secondary-900 truncate">
            {storeName}
          </h3>
          <p className="text-xs text-secondary-500">AI Assistant</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 transition-colors"
                title="Export chat"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="rounded-lg p-1.5 text-secondary-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <div className="flex items-center gap-1.5 ml-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-secondary-500">Online</span>
          </div>
        </div>
      </div>

      {/* Clear confirmation bar */}
      {showClearConfirm && (
        <div className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2">
          <span className="text-xs text-red-700">Clear entire chat history?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="rounded px-2 py-1 text-xs text-secondary-600 hover:bg-secondary-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearChat}
              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Size warning */}
      {isNearLimit && !isAtLimit && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700">
            Chat is getting long ({messages.length} messages). Consider clearing or exporting.
          </span>
        </div>
      )}
      {isAtLimit && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs text-red-700">
            Chat limit reached ({messages.length} messages). Please clear to continue.
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="chat-scroll flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 mb-4">
              <Bot className="h-8 w-8 text-primary-600" />
            </div>
            <h4 className="text-sm font-semibold text-secondary-800 mb-1">
              Welcome to your AI Assistant
            </h4>
            <p className="text-xs text-secondary-500 max-w-[260px] leading-relaxed">
              I can help you manage products, update prices, process orders, scan
              inventory photos, and more. Just ask!
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                'Show low stock alerts',
                "Today's sales summary",
                'Recent orders',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInputValue(suggestion)
                    inputRef.current?.focus()
                  }}
                  className={cn(
                    'rounded-full border border-secondary-200 bg-white px-3 py-1.5 text-xs text-secondary-600',
                    'hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50',
                    'transition-colors duration-150',
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))}

        {isTyping && (
          <div className="flex gap-2.5 justify-start chat-message-in">
            <div className="shrink-0 mt-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100">
                <Bot className="h-4 w-4 text-primary-700" />
              </div>
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-white border border-secondary-200 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-secondary-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }} />
                <span className="h-2 w-2 rounded-full bg-secondary-400 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.4s' }} />
                <span className="h-2 w-2 rounded-full bg-secondary-400 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.4s' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-2.5 justify-start">
            <div className="shrink-0 mt-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <p>Something went wrong. Please try again.</p>
              <button
                type="button"
                onClick={() => {
                  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
                  if (lastUserMsg) {
                    const textPart = (lastUserMsg.parts ?? []).find((p) => p.type === 'text') as { text: string } | undefined
                    if (textPart?.text) {
                      setInputValue(textPart.text)
                      inputRef.current?.focus()
                    }
                  }
                }}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Retry last message
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image preview */}
      {imagePreview && selectedImage && (
        <ImageUploadPreview
          imageUrl={imagePreview}
          fileName={selectedImage.name}
          onRemove={clearImage}
          onScan={handleScan}
        />
      )}

      {/* Input area */}
      <div className="border-t border-secondary-200 bg-white p-4">
        <form id="chat-form" onSubmit={onFormSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'shrink-0 flex items-center justify-center rounded-full p-2.5',
              'text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100',
              'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
            )}
            aria-label="Upload image"
          >
            <Camera className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isAtLimit ? 'Clear chat to continue...' : 'Ask your AI assistant...'}
            className={cn(
              'flex-1 rounded-full bg-secondary-100 border-0 px-4 py-2.5 text-sm text-secondary-900',
              'placeholder:text-secondary-400',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white',
              'transition-all duration-200',
            )}
            disabled={isLoading || isAtLimit}
          />

          <button
            type="submit"
            disabled={!canSend || isAtLimit}
            className={cn(
              'shrink-0 flex items-center justify-center rounded-full p-2.5',
              'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
              canSend && !isAtLimit
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow'
                : 'bg-secondary-100 text-secondary-300 cursor-not-allowed',
            )}
            aria-label="Send message"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
