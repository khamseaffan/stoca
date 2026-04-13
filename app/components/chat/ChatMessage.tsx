'use client'

import { useMemo } from 'react'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToolCallCard } from './ToolCallCard'
import type { UIMessage } from 'ai'

interface ChatMessageProps {
  message: UIMessage
  isLast: boolean
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

function renderTextContent(text: string) {
  if (!text) return null
  const lines = text.split('\n')

  return lines.map((line, lineIndex) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={lineIndex} className="flex gap-2 pl-1">
          <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-50" />
          <span>{renderInlineFormatting(trimmed.slice(2))}</span>
        </div>
      )
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s(.*)/)
      if (match) {
        return (
          <div key={lineIndex} className="flex gap-2 pl-1">
            <span className="shrink-0 font-medium opacity-70">{match[1]}</span>
            <span>{renderInlineFormatting(match[2])}</span>
          </div>
        )
      }
    }
    if (trimmed === '') return <div key={lineIndex} className="h-2" />
    return <p key={lineIndex}>{renderInlineFormatting(line)}</p>
  })
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    const codeParts = part.split(/(`[^`]+`)/)
    return codeParts.map((codePart, j) => {
      if (codePart.startsWith('`') && codePart.endsWith('`')) {
        return (
          <code key={`${i}-${j}`} className="rounded bg-secondary-100 px-1 py-0.5 text-[0.85em] font-mono text-secondary-700">
            {codePart.slice(1, -1)}
          </code>
        )
      }
      return <span key={`${i}-${j}`}>{codePart}</span>
    })
  })
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const timestamp = useMemo(() => formatTime(new Date()), [])

  // Extract text and tool parts from the v6 parts array
  const textContent = (message.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('')

  const toolParts = (message.parts ?? [])
    .filter((p) => p.type.startsWith('tool-') || p.type === 'dynamic-tool')
    .map((p) => p as unknown as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown; errorText?: string })

  // Extract file parts for images
  const fileParts = (message.parts ?? [])
    .filter((p) => p.type === 'file')
    .map((p) => p as unknown as { type: 'file'; data: string; mediaType: string })

  return (
    <div className={cn('flex gap-2.5 chat-message-in', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="shrink-0 mt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100">
            <Bot className="h-4 w-4 text-primary-700" />
          </div>
        </div>
      )}

      <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start', 'max-w-[80%]')}>
        {fileParts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {fileParts.map((fp, idx) => (
              <img
                key={idx}
                src={`data:${fp.mediaType};base64,${fp.data}`}
                alt="Attached image"
                className="h-32 w-32 rounded-lg object-cover border border-secondary-200 shadow-sm"
              />
            ))}
          </div>
        )}

        {textContent && (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-colors duration-200',
              isUser
                ? 'bg-primary-600 text-white rounded-br-sm'
                : 'bg-white border border-secondary-200 text-secondary-800 rounded-bl-sm shadow-sm',
            )}
          >
            <div className={cn('space-y-1', isUser ? '[&_code]:bg-primary-700/40 [&_code]:text-primary-100' : '')}>
              {renderTextContent(textContent)}
            </div>
          </div>
        )}

        {toolParts.length > 0 && (
          <div className="w-full mt-1">
            {toolParts.map((part) => (
              <ToolCallCard key={part.toolCallId} toolPart={part} />
            ))}
          </div>
        )}

        <span className={cn('mt-1 text-xs text-secondary-400 select-none', isUser ? 'pr-1' : 'pl-1')}>
          {timestamp}
        </span>
      </div>

      {isUser && (
        <div className="shrink-0 mt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-200">
            <User className="h-4 w-4 text-secondary-600" />
          </div>
        </div>
      )}
    </div>
  )
}
