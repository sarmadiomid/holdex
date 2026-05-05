'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, TrendingDown, User, Clock, Users, Gem } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { cn } from '@/lib/utils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

function formatTimeLeft(endsAt: Date): { days: number; hours: number; minutes: number; seconds: number } {
  const diff = Math.max(0, endsAt.getTime() - Date.now())
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000)
  }
}

const rankStyles: Record<number, { text: string; bg: string; border: string; glow?: string }> = {
  1: { text: 'text-neon-gold', bg: 'bg-neon-gold/20', border: 'border-neon-gold/60', glow: 'shadow-neon-gold/30' },
  2: { text: 'text-foreground', bg: 'bg-foreground/10', border: 'border-foreground/30' },
  3: { text: 'text-neon-pink', bg: 'bg-neon-pink/20', border: 'border-neon-pink/50', glow: 'shadow-neon-pink/20' },
}

export function Leaderboard() {
  const { isReady } = useTelegram()
  const token = useAppStore((state) => state.token)
  const user = useAppStore((state) => state.user)
  const leaderboardData = useAppStore((state) => state.leaderboardData)
  const leaderboard = useAppStore((state) => state.leaderboard)
  const setLeaderboard = useAppStore((state) => state.setLeaderboard)
  const [loading, setLoading] = useState(true)

  const prizePool = leaderboardData?.prizePool ?? 500
  const distribution = leaderboardData?.distribution ?? []
  const totalParticipants = leaderboardData?.totalParticipants ?? 0
  const weekEnd = leaderboardData?.weekEnd ?? new Date()
  const season = leaderboardData?.season ?? 1
  const userPosition = leaderboardData?.userPosition

  const [time, setTime] = useState(formatTimeLeft(weekEnd))

  useEffect(() => {
    const id = setInterval(() => setTime(formatTimeLeft(weekEnd)), 1000)
    return () => clearInterval(id)
  }, [weekEnd])

  useEffect(() => {
    if (!isReady || !token) return

    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/leaderboard?limit=500`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data)
        }
      } catch {
        console.error('[leaderboard] Failed to fetch')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [isReady, token, setLeaderboard])

  const getTonPrize = (rank: number): number | null => {
    const entry = distribution.find(d => d.rank === rank)
    return entry?.tonAmount ?? null
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 py-4">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="size-10 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 py-4">

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-cyan/20 border border-neon-cyan/40">
            <Users className="size-3.5 text-neon-cyan" />
            <span className="text-xs font-mono text-neon-cyan">{totalParticipants.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Season {season} — Weekly tournament</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <GlassCard glow="gold" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-gold/10 via-transparent to-neon-cyan/5 pointer-events-none" />
          <div className="relative flex flex-col gap-4">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-neon-gold/20 border border-neon-gold/40 flex items-center justify-center">
                  <Trophy className="size-5 text-neon-gold" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Prize Pool</p>
                  <div className="flex items-center gap-1.5">
                    <Gem className="size-4 text-neon-cyan" />
                    <NeonText glow="gold" className="text-2xl font-bold font-mono">
                      {prizePool.toLocaleString()}
                    </NeonText>
                    <span className="text-sm text-muted-foreground font-medium">TON</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 justify-end mb-1">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Ends in</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-sm font-bold text-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-muted/40">{String(time.days).padStart(2, '0')}d</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted/40">{String(time.hours).padStart(2, '0')}h</span>
                  <span className="text-muted-foreground">:</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted/40">{String(time.minutes).padStart(2, '0')}m</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((rank) => {
                const prize = getTonPrize(rank)
                const styles = rankStyles[rank]
                const labels = ['1st Place', '2nd Place', '3rd Place']
                return (
                  <div
                    key={rank}
                    className={cn(
                      'rounded-xl p-3 text-center border',
                      styles.bg,
                      styles.border,
                      styles.glow && `shadow-lg ${styles.glow}`
                    )}
                  >
                    <p className="text-xs text-muted-foreground mb-1">{labels[rank - 1]}</p>
                    <div className="flex items-center justify-center gap-1">
                      <Gem className={cn('size-3.5', styles.text)} />
                      <span className={cn('text-base font-bold font-mono', styles.text)}>
                        {prize ?? '—'}
                      </span>
                    </div>
                    <p className={cn('text-xs font-medium', styles.text)}>TON</p>
                  </div>
                )
              })}
            </div>

          </div>
        </GlassCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard glow="cyan" className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan rounded-l-xl" />
          <div className="flex items-center justify-between pl-2">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-pink flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-background">{user.firstName.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">You</p>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <div className="text-right">
              <NeonText glow="cyan" className="text-base font-bold font-mono">
                {user.portfolioValue.toLocaleString()}
              </NeonText>
              <div className={cn(
                'flex items-center justify-end gap-1 text-xs',
                user.totalPnl >= 0 ? 'text-neon-green' : 'text-neon-pink'
              )}>
                {user.totalPnl >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                <span className="font-mono">{user.totalPnl >= 0 ? '+' : ''}{user.totalPnlPercent.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <section>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">All Players</h2>
        <div className="flex flex-col gap-2">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="size-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No rankings yet this week</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to allocate!</p>
            </div>
          ) : (
            leaderboard.map((entry, index) => {
              const prize = getTonPrize(entry.rank)
              const styles = rankStyles[entry.rank]
              const isPositive = entry.pnl >= 0

              return (
                <motion.div
                  key={entry.user.id || index}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.04 }}
                >
                  <div className={cn(
                    'glass rounded-xl p-3 flex items-center justify-between',
                    styles && `border ${styles.border}`,
                    styles?.glow && `shadow-sm ${styles.glow}`
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'size-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                        styles ? `${styles.bg} ${styles.text}` : 'bg-muted/40 text-muted-foreground'
                      )}>
                        {entry.rank}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground leading-none mb-0.5">{entry.user.firstName}</p>
                          <p className="text-xs text-muted-foreground">@{entry.user.username}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5">
                      <p className="text-sm font-mono text-foreground">{entry.portfolioValue.toLocaleString()}</p>
                      <p className={cn('text-xs font-mono', isPositive ? 'text-neon-green' : 'text-neon-pink')}>
                        {isPositive ? '+' : ''}{entry.pnlPercent.toFixed(2)}%
                      </p>
                      {prize !== null && (
                        <div className="flex items-center gap-1">
                          <Gem className={cn('size-3', styles?.text ?? 'text-muted-foreground')} />
                          <span className={cn('text-xs font-bold font-mono', styles?.text ?? 'text-muted-foreground')}>
                            {prize} TON
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </section>

    </div>
  )
}
