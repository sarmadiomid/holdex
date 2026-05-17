'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Zap, Sparkles, Crown, Gem, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
const MAX_ZLR_BALANCE = 1000

const storeItems = [
  { id: 'zlr_50', name: '50 ZLR', description: 'Micro pack for quick starts', starsPrice: 10, type: 'zlr', value: 50 },
  { id: 'zlr_100', name: '100 ZLR', description: 'Starter pack for new investors', starsPrice: 20, type: 'zlr', value: 100 },
  { id: 'zlr_250', name: '250 ZLR', description: 'Popular choice for active traders', starsPrice: 40, type: 'zlr', value: 250 },
  { id: 'zlr_500', name: '500 ZLR', description: 'Maximum package size', starsPrice: 70, type: 'zlr', value: 500 },
  { id: 'lev_2x', name: '2x Leverage', description: 'Double your gains (and losses)', starsPrice: 250, type: 'leverage', value: 2 },
  { id: 'lev_5x', name: '5x Leverage', description: 'High risk, high reward', starsPrice: 1, type: 'leverage', value: 5 },
  { id: 'lev_10x', name: '10x Leverage', description: 'Maximum power mode', starsPrice: 1000, type: 'leverage', value: 10 },
]
import { cn } from '@/lib/utils'
import { debugLog } from '@/lib/debug'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export function StorePage() {
  const { haptic, openInvoice, isTelegram } = useTelegram()
  const user = useAppStore((state) => state.user)
  const token = useAppStore((state) => state.token)
  const setLeverage = useAppStore((state) => state.setLeverage)
  const addBalance = useAppStore((state) => state.addBalance)
  const setUser = useAppStore((state) => state.setUser)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const zlrItems = storeItems.filter(item => item.type === 'zlr')
  const leverageItems = storeItems.filter(item => item.type === 'leverage')

  const handlePurchase = async (item: typeof storeItems[0]) => {
    if (purchasingId || !token) return

    // Frontend cap check before attempting purchase
    if (item.type === 'zlr' && item.value && user.balance + item.value > MAX_ZLR_BALANCE) {
      setError(`Cannot purchase. This package would exceed your maximum allowed balance of ${MAX_ZLR_BALANCE.toLocaleString()} ZLR.`)
      haptic.notification('warning')
      return
    }

    setPurchasingId(item.id)
    setError(null)
    haptic.impact('medium')

    try {
      const res = await fetch(`${BACKEND_URL}/api/stars/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packageId: item.id }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to create invoice' }))
        const errorMessage = errorData.error || `Server error: ${res.status}`
        setError(errorMessage)
        haptic.notification('error')
        setPurchasingId(null)
        return
      }

      const data = await res.json()

      if (!data.invoiceUrl) {
        setError('Invalid response from server - missing invoice URL')
        haptic.notification('error')
        setPurchasingId(null)
        return
      }

      if (isTelegram) {
        debugLog('[store] Opening Telegram invoice:', data.invoiceUrl)
        const status = await openInvoice(data.invoiceUrl)
        debugLog('[store] Invoice closed with status:', status)

        if (status === 'paid') {
          haptic.notification('success')
          
          // Optimistically update UI (will be confirmed by webhook)
          if (item.type === 'zlr' && item.value) {
            addBalance(item.value)
            if (user) {
              setUser({
                balance: user.balance + item.value,
                portfolioValue: user.portfolioValue + item.value,
              })
            }
          } else if (item.type === 'leverage' && item.value) {
            setLeverage(item.value)
            if (user) {
              setUser({ leverage: item.value })
            }
          }
          
          setSuccessId(item.id)
          setTimeout(() => setSuccessId(null), 2500)
        } else if (status === 'pending') {
          haptic.notification('success')
          setSuccessId(item.id)
          setTimeout(() => setSuccessId(null), 2500)
        } else if (status === 'cancelled') {
          setError('Payment was cancelled')
          haptic.notification('warning')
        } else if (status === 'failed') {
          setError('Payment failed. Please try again.')
          haptic.notification('error')
        } else {
          setError(`Payment status: ${status}`)
          haptic.notification('warning')
        }
      } else {
        // Non-Telegram fallback (for testing in browser)
        haptic.notification('success')
        if (item.type === 'zlr' && item.value) {
          addBalance(item.value)
        } else if (item.type === 'leverage' && item.value) {
          setLeverage(item.value)
        }
        setSuccessId(item.id)
        setTimeout(() => setSuccessId(null), 2500)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error - please check your connection'
      setError(errorMessage)
      haptic.notification('error')
    } finally {
      setPurchasingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-4">

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 relative"
        >
          <AlertCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 leading-relaxed flex-1">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Store</h1>
        <p className="text-sm text-muted-foreground">Buy features with Telegram Stars</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <GlassCard glow="cyan">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center">
                <Coins className="size-5 text-neon-cyan" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Your ZLR Balance</p>
                <NeonText glow="cyan" className="text-2xl font-bold font-mono">
                  {user.balance.toLocaleString()}
                </NeonText>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Max Wallet</p>
              <p className="text-sm font-bold text-neon-cyan font-mono">{MAX_ZLR_BALANCE.toLocaleString()} ZLR</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (user.balance / MAX_ZLR_BALANCE) * 100)}%` }}
            />
          </div>
          {user.leverage > 1 && (
            <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-gold/20 border border-neon-gold/40 w-fit">
              <Zap className="size-4 text-neon-gold" />
              <span className="text-sm font-bold text-neon-gold">{user.leverage}x Leverage Active</span>
            </div>
          )}
        </GlassCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-neon-gold/10 border border-neon-gold/30">
          <Gem className="size-5 text-neon-gold shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isTelegram
              ? 'All purchases use Telegram Stars — a secure native payment inside Telegram. No card or crypto wallet needed.'
              : 'Open in Telegram to purchase with Stars.'}
          </p>
        </div>
      </motion.div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-neon-cyan" />
          <h2 className="text-base font-semibold text-foreground">ZLR Packages</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {zlrItems.map((item, index) => {
            const isPurchasing = purchasingId === item.id
            const isSuccess = successId === item.id
            const isBestValue = index === zlrItems.length - 1
            const isOverCap = item.value ? user.balance + item.value > MAX_ZLR_BALANCE : false

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.07 }}
              >
                <GlassCard hover={!isOverCap} className={cn('h-full flex flex-col gap-3', isOverCap && 'opacity-50')}>
                  <div className="flex items-start justify-between">
                    <div className={cn('size-10 rounded-lg border flex items-center justify-center', isOverCap ? 'bg-muted/20 border-border/30' : 'bg-neon-cyan/20 border-neon-cyan/40')}>
                      <Coins className={cn('size-5', isOverCap ? 'text-muted-foreground' : 'text-neon-cyan')} />
                    </div>
                    {isBestValue && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink border border-neon-pink/40 font-medium">
                        Max Cap
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>

                  <Button
                    onClick={() => handlePurchase(item)}
                    disabled={isOverCap || !!purchasingId}
                    className={cn(
                      'w-full gap-1.5 text-sm transition-all',
                      isSuccess
                        ? 'bg-neon-green/20 border-neon-green/40 text-neon-green'
                        : isOverCap
                          ? 'bg-muted/20 text-muted-foreground border border-border/30 cursor-not-allowed'
                          : 'bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan border border-neon-cyan/40'
                    )}
                    title={isOverCap ? `Your wallet cannot exceed ${MAX_ZLR_BALANCE.toLocaleString()} ZLR` : undefined}
                  >
                    <AnimatePresence mode="wait">
                      {isOverCap ? (
                        <motion.span key="cap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[11px]">
                          Wallet Full
                        </motion.span>
                      ) : isPurchasing ? (
                        <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Loader2 className="size-4 animate-spin" />
                        </motion.span>
                      ) : isSuccess ? (
                        <motion.span key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                          <CheckCircle className="size-4" />
                          Purchased
                        </motion.span>
                      ) : (
                        <motion.span key="price" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                          <StarIcon className="size-4" />
                          {item.starsPrice} Stars
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="size-4 text-neon-gold" />
          <h2 className="text-base font-semibold text-foreground">Leverage Boosters</h2>
        </div>

        <div className="flex flex-col gap-3">
          {leverageItems.map((item, index) => {
            const isActive = user.leverage === item.value
            const isPurchasing = purchasingId === item.id
            const isSuccess = successId === item.id

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.07 }}
              >
                <GlassCard glow={isActive ? 'gold' : 'none'} className={cn(isActive && 'border-neon-gold/60')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'size-11 rounded-xl flex items-center justify-center border',
                        isActive ? 'bg-neon-gold/30 border-neon-gold' : 'bg-neon-gold/15 border-neon-gold/40'
                      )}>
                        {item.value === 10 ? (
                          <Crown className="size-5 text-neon-gold" />
                        ) : (
                          <Zap className="size-5 text-neon-gold" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground text-sm">{item.name}</h3>
                          {isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/30">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePurchase(item)}
                      disabled={isActive || !!purchasingId}
                      className={cn(
                        'shrink-0 gap-1.5 text-sm',
                        isActive
                          ? 'bg-muted/30 text-muted-foreground border border-border/30 cursor-not-allowed'
                          : isSuccess
                            ? 'bg-neon-green/20 border-neon-green/40 text-neon-green'
                            : 'bg-neon-gold/20 hover:bg-neon-gold/30 text-neon-gold border border-neon-gold/40'
                      )}
                    >
                      {isActive ? (
                        'Active'
                      ) : isPurchasing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isSuccess ? (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="size-4" /> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <StarIcon className="size-4" />
                          {item.starsPrice}
                        </span>
                      )}
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      </section>

    </div>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.582 6.953L22 9.257l-5.5 5.357 1.637 7.386L12 18.202l-6.137 3.798L7.5 14.614 2 9.257l7.418-.304z" />
    </svg>
  )
}
