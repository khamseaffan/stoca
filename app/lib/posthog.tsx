'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import React, { useEffect, Suspense } from 'react'

export function PostHogInit() {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
      })
    }
  }, [])

  return null
}

function PostHogPageViewInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + '?' + searchParams.toString()
      }
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  )
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>
}

// Event tracking helpers
export const trackEvent = {
  onboardingStepCompleted: (step: number) =>
    posthog.capture('onboarding_step_completed', { step }),
  storeCreated: (storeId: string) =>
    posthog.capture('store_created', { store_id: storeId }),
  orderPlaced: (orderId: string, total: number) =>
    posthog.capture('order_placed', { order_id: orderId, total }),
  orderAccepted: (orderId: string) =>
    posthog.capture('order_accepted', { order_id: orderId }),
  aiChatMessageSent: (storeId: string) =>
    posthog.capture('ai_chat_message_sent', { store_id: storeId }),
  aiToolExecuted: (toolName: string, storeId: string) =>
    posthog.capture('ai_tool_executed', { tool_name: toolName, store_id: storeId }),
  productAddedToCart: (productId: string) =>
    posthog.capture('product_added_to_cart', { product_id: productId }),
  searchPerformed: (query: string) =>
    posthog.capture('search_performed', { query }),
}
