'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, AlertCircle, PieChart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { AllocationSlider } from '@/components/allocation/allocation-slider'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { cn } from '@/lib/utils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export function Allocate() {
  const { haptic } = useTelegram()
  const assets = useAppStore((state) => state.assets)
  const allocations = useAppStore((state) => state.allocations)
  const user = useAppStore((state) => state.user)
  const token = useAppStore((state) => state.token)
  const setAllocations = useAppStore((state) => state.setAllocations)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0)
  const availablePercent = 100 - totalAllocated
  const hasAllocations = totalAllocated > 0

  const handleConfirm = async () => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    haptic.impact('medium')

    try {
      const res = await fetch(`${BACKEND_URL}/api/allocation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          BTC: allocations.BTC,
          GOLD: allocations.GOLD,
          OIL: allocations.OIL,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Failed to confirm allocation')
        haptic.notification('error')
        return
      }

      const data = await res.json()
      setAllocations(data.allocations)
      haptic.notification('success')
      setActiveTab('dashboard')
    } catch {
      setError('Network error. Please try again.')
      haptic.notification('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-foreground mb-1">Allocate Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Distribute your {user.balance.toLocaleString()} HLX across assets
        </p>
      </motion.div>

      <GlassCard glow={hasAllocations ? 'cyan' : 'none'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="size-5 text-neon-cyan" />
            <span className="font-medium text-foreground">Distribution</span>
          </div>
          <div className="text-right">
            <NeonText glow="cyan" className="text-xl font-bold font-mono">
              {totalAllocated}%
            </NeonText>
            <span className="text-sm text-muted-foreground"> allocated</span>
          </div>
        </div>

        <div className="h-4 rounded-full bg-muted/30 overflow-hidden flex mb-3">
          {assets.map((asset) => {
            const allocation = allocations[asset.id] || 0
            if (allocation === 0) return null

            const colorMap = {
              'neon-gold': 'bg-neon-gold',
              'neon-cyan': 'bg-neon-cyan',
              'neon-pink': 'bg-neon-pink'
            }

            return (
              <motion.div
                key={asset.id}
                className={cn(colorMap[asset.color as keyof typeof colorMap], 'relative')}
                initial={{ width: 0 }}
                animate={{ width: `${allocation}%` }}
                transition={{ duration: 0.3 }}
              >
                {allocation >= 15 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-background">
                    {allocation}%
                  </span>
                )}
              </motion.div>
            )
          })}
          {availablePercent > 0 && (
            <motion.div
              className="bg-muted/50 flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {assets.map((asset) => {
            const allocation = allocations[asset.id] || 0
            const colorMap = {
              'neon-gold': 'bg-neon-gold',
              'neon-cyan': 'bg-neon-cyan',
              'neon-pink': 'bg-neon-pink'
            }

            return (
              <div key={asset.id} className="flex items-center gap-1.5 text-sm">
                <div className={cn('size-2.5 rounded-full', colorMap[asset.color as keyof typeof colorMap])} />
                <span className="text-muted-foreground">{asset.symbol}</span>
                <span className="font-mono text-foreground">{allocation}%</span>
              </div>
            )
          })}
          <div className="flex items-center gap-1.5 text-sm">
            <div className="size-2.5 rounded-full bg-muted" />
            <span className="text-muted-foreground">Free</span>
            <span className="font-mono text-foreground">{availablePercent}%</span>
          </div>
        </div>
      </GlassCard>

      {totalAllocated > 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-destructive/20 border border-destructive/40"
        >
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            Total allocation cannot exceed 100%
          </p>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-neon-pink/20 border border-neon-pink/40"
        >
          <AlertCircle className="size-5 text-neon-pink shrink-0" />
          <p className="text-sm text-neon-pink">{error}</p>
        </motion.div>
      )}

      <div className="flex flex-col gap-4">
        {assets.map((asset) => (
          <AllocationSlider
            key={asset.id}
            asset={asset}
            maxAvailable={availablePercent}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          onClick={handleConfirm}
          disabled={!hasAllocations || submitting}
          className={cn(
            'w-full h-14 text-lg font-semibold rounded-xl transition-all',
            hasAllocations && !submitting
              ? 'bg-gradient-to-r from-neon-cyan to-neon-pink text-background neon-glow-cyan'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 mr-2 animate-spin" />
              Confirming...
            </>
          ) : (
            <>
              <Check className="size-5 mr-2" />
              Confirm Allocation
            </>
          )}
        </Button>

        {!hasAllocations && !submitting && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            Allocate at least some funds to continue
          </p>
        )}
      </motion.div>
    </div>
  )
}
