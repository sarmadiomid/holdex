'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useTelegram } from '@/hooks/use-telegram'
import { useAppStore } from '@/lib/store'
import type { Asset } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AssetCardProps {
  asset: Asset
  index: number
}

const assetIcons: Record<string, string> = {
  BTC: '₿',
  GOLD: 'Au',
  EUR: '€'
}

export function AssetCard({ asset, index }: AssetCardProps) {
  const { haptic } = useTelegram()
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const allocations = useAppStore((state) => state.allocations)
  
  const isPositive = asset.change24h >= 0
  const allocation = allocations[asset.id] || 0

  const colorMap = {
    'neon-gold': {
      bg: 'bg-neon-gold/20',
      border: 'border-neon-gold/40',
      text: 'text-neon-gold',
      glow: 'gold' as const
    },
    'neon-cyan': {
      bg: 'bg-neon-cyan/20',
      border: 'border-neon-cyan/40',
      text: 'text-neon-cyan',
      glow: 'cyan' as const
    },
    'neon-pink': {
      bg: 'bg-neon-pink/20',
      border: 'border-neon-pink/40',
      text: 'text-neon-pink',
      glow: 'pink' as const
    }
  }

  const colors = colorMap[asset.color as keyof typeof colorMap] || colorMap['neon-cyan']

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <GlassCard 
        hover 
        glow={allocation > 0 ? colors.glow : 'none'}
        className="cursor-pointer"
        onClick={() => {
          haptic.selection()
          setActiveTab('allocate')
        }}
      >
        <div className="flex items-center justify-between">
          {/* Asset Info */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'size-12 rounded-xl flex items-center justify-center border',
              colors.bg,
              colors.border
            )}>
              <span className={cn('text-xl font-bold', colors.text)}>
                {assetIcons[asset.id]}
              </span>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground">{asset.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{asset.symbol}</span>
                {allocation > 0 && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-md font-medium',
                    colors.bg,
                    colors.text
                  )}>
                    {allocation}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Price Info */}
          <div className="text-right">
            <motion.p 
              className="font-mono font-semibold text-foreground"
              key={asset.price}
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
            >
              ${asset.price.toLocaleString(undefined, {
                minimumFractionDigits: asset.id === 'EUR' ? 4 : 2,
                maximumFractionDigits: asset.id === 'EUR' ? 4 : 2
              })}
            </motion.p>
            <div className={cn(
              'flex items-center justify-end gap-1 text-sm',
              isPositive ? 'text-neon-green' : 'text-neon-pink'
            )}>
              {isPositive ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              <span className="font-mono">
                {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}
