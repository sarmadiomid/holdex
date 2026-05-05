'use client'

import { useEffect, useState, useCallback } from 'react'
import type { TelegramWebApp, TelegramUser } from '@/lib/types'

interface UseTelegramReturn {
  webApp: TelegramWebApp | null
  user: TelegramUser | null
  isReady: boolean
  isTelegram: boolean
  themeParams: TelegramWebApp['themeParams'] | null
  haptic: {
    impact: (style?: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notification: (type?: 'error' | 'success' | 'warning') => void
    selection: () => void
  }
  openInvoice: (invoiceUrl: string) => Promise<'paid' | 'cancelled' | 'failed' | 'pending'>
}

export function useTelegram(): UseTelegramReturn {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initTelegram = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp
        setWebApp(tg)

        tg.expand()
        tg.ready()

        setIsReady(true)
      } else {
        console.log('[telegram] Running outside Telegram')
        setIsReady(true)
      }
    }

    const timer = setTimeout(initTelegram, 100)
    return () => clearTimeout(timer)
  }, [])

  const haptic = {
    impact: useCallback((style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.impactOccurred(style)
      } else {
        console.log('[telegram] Haptic impact:', style)
      }
    }, [webApp]),

    notification: useCallback((type: 'error' | 'success' | 'warning' = 'success') => {
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred(type)
      } else {
        console.log('[telegram] Haptic notification:', type)
      }
    }, [webApp]),

    selection: useCallback(() => {
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.selectionChanged()
      } else {
        console.log('[telegram] Haptic selection')
      }
    }, [webApp])
  }

  const openInvoice = useCallback((invoiceUrl: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> => {
    return new Promise((resolve) => {
      if (webApp?.openInvoice) {
        webApp.openInvoice(invoiceUrl, (status) => {
          resolve(status)
        })
      } else {
        console.log('[telegram] Mock payment for invoice:', invoiceUrl)
        setTimeout(() => resolve('paid'), 1000)
      }
    })
  }, [webApp])

  return {
    webApp,
    user: webApp?.initDataUnsafe.user || null,
    isReady,
    isTelegram: !!webApp,
    themeParams: webApp?.themeParams || null,
    haptic,
    openInvoice
  }
}
