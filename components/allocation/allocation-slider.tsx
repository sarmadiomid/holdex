'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import type { Asset, AssetType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AllocationSliderProps {
  asset: Asset
  maxAvailable: number
}

const assetIcons: Record<string, string> = {
  BTC: '₿',
  GOLD: 'Au',
  EUR: '€'
}

export function AllocationSlider({ asset, maxAvailable }: AllocationSliderProps) {
  const { haptic } = useTelegram()
  const allocations = useAppStore((state) => state.allocations)
  const setAllocations = useAppStore((state) => state.setAllocations)
  const user = useAppStore((state) => state.user)

  const currentAllocation = allocations[asset.id] || 0
  const allocatedValue = (user.balance * currentAllocation) / 100

  const colorMap = {
    'neon-gold': {
      bg: 'bg-neon-gold/20',
      border: 'border-neon-gold/40',
      text: 'text-neon-gold',
      slider: '[&_[data-slot=slider-thumb]]:bg-neon-gold [&_[data-slot=slider-thumb]]:border-neon-gold [&_[data-slot=slider-range]]:bg-neon-gold'
    },
    'neon-cyan': {
      bg: 'bg-neon-cyan/20',
      border: 'border-neon-cyan/40',
      text: 'text-neon-cyan',
      slider: '[&_[data-slot=slider-thumb]]:bg-neon-cyan [&_[data-slot=slider-thumb]]:border-neon-cyan [&_[data-slot=slider-range]]:bg-neon-cyan'
    },
    'neon-pink': {
      bg: 'bg-neon-pink/20',
      border: 'border-neon-pink/40',
      text: 'text-neon-pink',
      slider: '[&_[data-slot=slider-thumb]]:bg-neon-pink [&_[data-slot=slider-thumb]]:border-neon-pink [&_[data-slot=slider-range]]:bg-neon-pink'
    }
  }

  const colors = colorMap[asset.color as keyof typeof colorMap] || colorMap['neon-cyan']

  const setSingleAllocation = useCallback((assetId: AssetType, value: number) => {
    const otherTotal = Object.entries(allocations)
      .filter(([id]) => id !== assetId)
      .reduce((sum, [, val]) => sum + val, 0)

    const maxAllowed = 100 - otherTotal
    const newValue = Math.min(value, maxAllowed)

    setAllocations({
      ...allocations,
      [assetId]: Math.max(0, newValue)
    })
  }, [allocations, setAllocations])

  const handleValueChange = useCallback((value: number[]) => {
    haptic.selection()
    setSingleAllocation(asset.id, value[0])
  }, [haptic, setSingleAllocation, asset.id])

  return (
    <motion.div
      className="glass rounded-xl p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'size-10 rounded-lg flex items-center justify-center border',
            colors.bg,
            colors.border
          )}>
            <span className={cn('text-lg font-bold', colors.text)}>
              {assetIcons[asset.id]}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{asset.name}</h3>
            <p className="text-sm text-muted-foreground">
              ${asset.price.toLocaleString(undefined, { 
                minimumFractionDigits: asset.id === 'EUR' ? 4 : 2,
                maximumFractionDigits: asset.id === 'EUR' ? 4 : 2
              })}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className={cn('text-2xl font-bold font-mono', colors.text)}>
            {currentAllocation}%
          </p>
          <p className="text-xs text-muted-foreground">
            {allocatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} HLX
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Slider
          value={[currentAllocation]}
          onValueChange={handleValueChange}
          max={currentAllocation + maxAvailable}
          step={1}
          className={cn(colors.slider)}
        />

        <div className="flex items-center gap-2">
          {[0, 25, 50, 75, 100].map((percent) => {
            const maxAllowed = Math.min(percent, currentAllocation + maxAvailable)
            const isDisabled = maxAllowed < percent
            const isActive = currentAllocation === percent

            return (
              <motion.button
                key={percent}
                onClick={() => {
                  if (!isDisabled) {
                    haptic.impact('light')
                    setSingleAllocation(asset.id, maxAllowed)
                  }
                }}
                disabled={isDisabled}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all',
                  isActive ? cn(colors.bg, colors.text, 'border', colors.border) :
                  isDisabled ? 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed' :
                  'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                )}
                whileTap={!isDisabled ? { scale: 0.95 } : undefined}
              >
                {percent}%
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
