'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { useAppStore } from '@/lib/store'
import { debugLog } from '@/lib/debug'

interface UseSocketOptions {
  token: string | null
  enabled: boolean
}

export function useSocket({ token, enabled }: UseSocketOptions) {
  const updateAssetPrice = useAppStore((state) => state.updateAssetPrice)
  const setUserPrices = useAppStore((state) => state.setUserPrices)
  const updateUserFromSocket = useAppStore((state) => state.updateUserFromSocket)
  const handlersRef = useRef(false)

  const setupHandlers = useCallback(() => {
    if (!token || handlersRef.current) return
    handlersRef.current = true

    const s = getSocket(token)

    s.on('connect', () => {
      debugLog('[socket] Connected to backend')
    })

    s.on('disconnect', () => {
      debugLog('[socket] Disconnected from backend')
    })

    s.on('connect_error', (error) => {
      debugLog('[socket] Connection error:', error.message)
      
      // Handle rate limiting errors
      if (error.message.includes('rate limit')) {
        debugLog('[socket] Rate limit exceeded - connection blocked temporarily')
        // TODO: Show user-friendly message in UI
      } else if (error.message.includes('Authentication')) {
        debugLog('[socket] Authentication failed - invalid or expired token')
        // TODO: Redirect to login or refresh token
      } else if (error.message.includes('concurrent connections')) {
        debugLog('[socket] Too many concurrent connections from this device')
        // TODO: Show message to close other tabs
      }
    })

    s.on('rate_limit_error', (data: { message: string; event: string; retryAfter: number }) => {
      debugLog(`[socket] Rate limit exceeded for event: ${data.event}. Retry after ${data.retryAfter}s`)
      // TODO: Show toast notification to user
      // Example: "You're sending messages too quickly. Please wait {retryAfter} seconds"
    })

    s.on('price_update', (data: { symbol: string; price: number; timestamp: number }) => {
      updateAssetPrice(data.symbol, data.price)
    })

    s.on('prices_snapshot', (data: Record<string, { symbol: string; price: number; timestamp: number }>) => {
      setUserPrices(data)
    })

    s.on('user_update', (data: {
      portfolioValue?: number
      totalPnl?: number
      totalPnlPercent?: number
      assetLeverages?: Record<string, number>
      initialPrices?: Record<string, number | null>
    }) => {
      updateUserFromSocket(data)
    })
  }, [token, updateAssetPrice, setUserPrices, updateUserFromSocket])

  useEffect(() => {
    if (!enabled || !token) return

    const s = getSocket(token)
    setupHandlers()

    return () => {
      handlersRef.current = false
      s.off('price_update')
      s.off('prices_snapshot')
      s.off('user_update')
      s.off('connect')
      s.off('disconnect')
      s.off('connect_error')
      s.off('rate_limit_error')
    }
  }, [token, enabled, setupHandlers])

  const cleanup = useCallback(() => {
    handlersRef.current = false
    disconnectSocket()
  }, [])

  return { cleanup }
}
