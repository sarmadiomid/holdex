'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function PortfolioCard() {
  const user = useAppStore((state) => state.user)
  const pricesLoaded = useAppStore((state) => state.pricesLoaded)
  const isPositive = user.totalPnl >= 0

  return (
    <GlassCard glow={isPositive ? 'green' : 'pink'} className="relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-pink/5" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-medium">Portfolio Value</span>
          {user.leverage > 1 && (
            <motion.div 
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-gold/20 border border-neon-gold/40"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap className="size-3 text-neon-gold" />
              <span className="text-xs font-bold text-neon-gold">{user.leverage}x</span>
            </motion.div>
          )}
        </div>

        {/* Value */}
        {!pricesLoaded ? (
          <div className="mb-4">
            <div className="h-10 w-48 bg-muted/30 rounded animate-pulse mb-2" />
            <div className="h-6 w-32 bg-muted/20 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <motion.div 
              className="mb-4"
              key={user.portfolioValue}
              initial={{ scale: 1.02 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500 }}
            >
              <NeonText glow="cyan" className="text-4xl font-bold font-mono tracking-tight">
                {user.portfolioValue.toLocaleString(undefined, { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2 
                })}
              </NeonText>
              <span className="text-lg text-muted-foreground ml-2">HLX</span>
            </motion.div>

            {/* PNL */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                isPositive ? 'bg-neon-green/20' : 'bg-neon-pink/20'
              )}>
                {isPositive ? (
                  <TrendingUp className="size-4 text-neon-green" />
                ) : (
                  <TrendingDown className="size-4 text-neon-pink" />
                )}
                <span className={cn(
                  'font-mono font-medium',
                  isPositive ? 'text-neon-green' : 'text-neon-pink'
                )}>
                  {isPositive ? '+' : ''}{user.totalPnl.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
              
              <div className={cn(
                'px-2 py-1 rounded-md',
                isPositive ? 'bg-neon-green/10' : 'bg-neon-pink/10'
              )}>
                <span className={cn(
                  'text-sm font-mono font-medium',
                  isPositive ? 'text-neon-green' : 'text-neon-pink'
                )}>
                  {isPositive ? '+' : ''}{user.totalPnlPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  )
}
