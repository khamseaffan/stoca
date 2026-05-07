'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-secondary-100 px-1 py-0.5 text-[0.85em] font-mono text-secondary-700">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-secondary-50 p-3 text-xs">{children}</pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="ml-4 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="pl-1">{children}</li>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-2 text-base font-bold">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-2 font-bold">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="mt-1.5 font-semibold">{children}</p>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-secondary-200">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-secondary-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-semibold text-secondary-700 border-b border-secondary-200">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-secondary-600 border-b border-secondary-100">{children}</td>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-primary-600 underline hover:text-primary-700" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-secondary-300 pl-3 italic text-secondary-600">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 border-secondary-200" />,
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const timestamp = useMemo(() => formatTime(new Date()), [])

  const textContent = (message.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('')

  const toolParts = (message.parts ?? [])
    .filter((p) => p.type.startsWith('tool-') || p.type === 'dynamic-tool')
    .map((p) => p as unknown as { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown; errorText?: string })

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
                ? 'bg-primary-600 text-white rounded-br-sm [&_code]:bg-primary-700/40 [&_code]:text-primary-100'
                : 'bg-white border border-secondary-200 text-secondary-800 rounded-bl-sm shadow-sm',
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents as never}
            >
              {textContent}
            </ReactMarkdown>
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
