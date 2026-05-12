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
    }
  }, [token, enabled, setupHandlers])

  const cleanup = useCallback(() => {
    handlersRef.current = false
    disconnectSocket()
  }, [])

  return { cleanup }
}
