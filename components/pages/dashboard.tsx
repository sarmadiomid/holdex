'use client'

import { motion } from 'framer-motion'
import { PortfolioCard } from '@/components/dashboard/portfolio-card'
import { PrizePoolCard } from '@/components/dashboard/prize-pool-card'
import { AssetCard } from '@/components/dashboard/asset-card'
import { useAppStore } from '@/lib/store'

export function Dashboard() {
  const assets = useAppStore((state) => state.assets)
  const allocations = useAppStore((state) => state.allocations)
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0)

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Prize Pool */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PrizePoolCard />
      </motion.section>

      {/* Portfolio Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <PortfolioCard />
      </motion.section>

      {/* Allocation Summary */}
      {totalAllocated > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">Allocation</h2>
            <span className="text-sm font-mono text-neon-cyan">{totalAllocated}% deployed</span>
          </div>
          
          {/* Allocation bar */}
          <div className="h-3 rounded-full bg-muted/30 overflow-hidden flex">
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
                  className={colorMap[asset.color as keyof typeof colorMap]}
                  initial={{ width: 0 }}
                  animate={{ width: `${allocation}%` }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />
              )
            })}
          </div>
        </motion.section>
      )}

      {/* Assets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Markets</h2>
          <span className="text-xs text-muted-foreground">Live prices</span>
        </div>
        
        <div className="flex flex-col gap-3">
          {assets.map((asset, index) => (
            <AssetCard key={asset.id} asset={asset} index={index} />
          ))}
        </div>
      </section>

      {/* Quick Stats */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Assets</p>
          <p className="text-lg font-bold text-neon-cyan">{assets.length}</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Allocated</p>
          <p className="text-lg font-bold text-neon-pink">{totalAllocated}%</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Available</p>
          <p className="text-lg font-bold text-neon-green">{100 - totalAllocated}%</p>
        </div>
      </motion.section>
    </div>
  )
}
