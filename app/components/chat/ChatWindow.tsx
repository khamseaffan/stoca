'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, SendHorizontal, Camera, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatMessage } from './ChatMessage'
import { ImageUploadPreview } from './ImageUploadPreview'

interface ChatWindowProps {
  storeId: string
  storeName: string
  className?: string
}

export function ChatWindow({ storeId, storeName, className }: ChatWindowProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/ai/chat', body: { storeId } }),
    [storeId],
  )

  const { messages, sendMessage, status, error } = useChat({
    id: `store-${storeId}`,
    transport,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

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
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

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

  // Determine if the assistant is typing
  const isTyping =
    isLoading &&
    (messages.length === 0 || messages[messages.length - 1]?.role === 'user')

  const canSend = (inputValue.trim().length > 0 || selectedImage !== null) && !isLoading

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
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-secondary-500">Online</span>
        </div>
      </div>

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
            placeholder="Ask your AI assistant..."
            className={cn(
              'flex-1 rounded-full bg-secondary-100 border-0 px-4 py-2.5 text-sm text-secondary-900',
              'placeholder:text-secondary-400',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white',
              'transition-all duration-200',
            )}
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              'shrink-0 flex items-center justify-center rounded-full p-2.5',
              'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
              canSend
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
