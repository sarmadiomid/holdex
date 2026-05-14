'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, History, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PortfolioCard } from '@/components/dashboard/portfolio-card'
import { PrizePoolCard } from '@/components/dashboard/prize-pool-card'
import { AssetCard } from '@/components/dashboard/asset-card'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { debugLog } from '@/lib/debug'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export function Dashboard() {
  const assets = useAppStore((state) => state.assets)
  const allocations = useAppStore((state) => state.allocations)
  const token = useAppStore((state) => state.token)
  const user = useAppStore((state) => state.user)
  const applySellResult = useAppStore((state) => state.applySellResult)
  const positionHistory = useAppStore((state) => state.positionHistory)
  const setPositionHistory = useAppStore((state) => state.setPositionHistory)
  const setLeaderboard = useAppStore((state) => state.setLeaderboard)
  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0)
  const [selling, setSelling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sellError, setSellError] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    if (!token) return

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/leaderboard?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data)
        }
      } catch (err) {
        console.error(err)
      }
    }

    fetchLeaderboard()
  }, [token, setLeaderboard])

  useEffect(() => {
    if (!token) return

    const fetchPositionHistory = async () => {
      try {
        setLoadingHistory(true)
        const res = await fetch(`${BACKEND_URL}/api/position-history`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setPositionHistory(data.history || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchPositionHistory()
  }, [token, setPositionHistory])

  const handleSellAll = async () => {
    if (!token) return
    setSelling(true)
    setSellError(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/allocation/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const err = await res.json()
        setSellError(err.error || 'Failed to sell holdings')
        return
      }

      const data = await res.json()
      applySellResult(data.newBalance)
      setShowConfirm(false)
      
      // Refresh position history after selling
      const historyRes = await fetch(`${BACKEND_URL}/api/position-history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setPositionHistory(historyData.history || [])
      }
    } catch {
      setSellError('Network error. Please try again.')
    } finally {
      setSelling(false)
    }
  }

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

          {/* Sell All Button */}
          <div className="mt-4">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-medium text-sm hover:bg-neon-pink/20 transition-all"
              >
                <ArrowDownRight className="size-4" />
                Sell All & Return to Wallet
              </button>
            ) : (
              <div className="rounded-xl bg-background/80 border border-neon-pink/40 p-4 space-y-3">
                <p className="text-sm text-foreground text-center font-medium">
                  Are you sure you want to sell all holdings?
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Your portfolio of {user.portfolioValue.toFixed(2)} HLX will be returned to your wallet.
                </p>
                {sellError && (
                  <p className="text-xs text-neon-pink text-center">{sellError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowConfirm(false); setSellError(null) }}
                    disabled={selling}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSellAll}
                    disabled={selling}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50',
                      selling
                        ? 'bg-neon-pink/30 text-neon-pink/60'
                        : 'bg-neon-pink text-background hover:bg-neon-pink/90'
                    )}
                  >
                    {selling ? 'Selling...' : 'Sell All'}
                  </button>
                </div>
              </div>
            )}
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

      {/* Position History */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <History className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-muted-foreground">Position History</h2>
        </div>

        {loadingHistory ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading history...</p>
          </div>
        ) : positionHistory.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No position history yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Your allocation and trading activity will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {positionHistory.slice(0, 10).map((entry) => {
              return (
                <div
                  key={entry.id}
                  className="glass rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        entry.type === 'sell'
                          ? 'size-8 rounded-full flex items-center justify-center bg-neon-pink/10'
                          : entry.type === 'allocate'
                          ? 'size-8 rounded-full flex items-center justify-center bg-neon-cyan/10'
                          : 'size-8 rounded-full flex items-center justify-center bg-neon-green/10'
                      }
                    >
                      {entry.type === 'sell' ? (
                        <TrendingDown className="size-4 text-neon-pink" />
                      ) : entry.type === 'allocate' ? (
                        <Minus className="size-4 text-neon-cyan" />
                      ) : (
                        <TrendingUp className="size-4 text-neon-green" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {entry.type === 'sell' ? 'Sell' : entry.type === 'allocate' ? 'Allocate' : entry.type}
                        {entry.asset ? ` ${entry.asset}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={
                      entry.pnl !== undefined
                        ? entry.pnl > 0
                          ? 'text-sm font-mono font-medium text-neon-green'
                          : 'text-sm font-mono font-medium text-neon-pink'
                        : entry.type === 'sell'
                        ? 'text-sm font-mono font-medium text-neon-pink'
                        : entry.type === 'allocate'
                        ? 'text-sm font-mono font-medium text-neon-cyan'
                        : 'text-sm font-mono font-medium text-muted-foreground'
                    }>
                      {entry.type === 'sell' ? (
                        entry.pnl !== undefined && Math.abs(entry.pnl) > 0.01 ? (
                          <>{entry.pnl > 0 ? '+' : ''}{entry.pnl.toFixed(2)} HLX</>
                        ) : (
                          <>-{Number(entry.hlxValue || 0).toFixed(2)} HLX</>
                        )
                      ) : entry.type === 'allocate' ? (
                        <>{Number(entry.hlxValue || 0).toFixed(2)} HLX</>
                      ) : entry.type === 'store_purchase' ? (
                        <>-{Number(entry.hlxValue || 0).toFixed(2)} HLX</>
                      ) : (
                        <>{Number(entry.hlxValue || 0).toFixed(2)} HLX</>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {entry.type === 'allocate' && 'Allocated'}
                      {entry.type === 'sell' && (
                        entry.pnl !== undefined && Math.abs(entry.pnl) > 0.01
                          ? entry.pnl > 0 ? '+Profit' : 'Loss'
                          : 'Break-even'
                      )}
                      {entry.type === 'sell' && (entry.pnl === undefined || Math.abs(entry.pnl) <= 0.01) && 'Received'}
                      {entry.type === 'store_purchase' && 'Spent'}
                      {entry.type === 'buy' && 'Bought'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.section>
    </div>
  )
}
