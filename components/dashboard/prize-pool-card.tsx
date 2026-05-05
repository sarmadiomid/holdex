'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Clock, Gem, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { useAppStore } from '@/lib/store'

function formatTimeLeft(endsAt: number) {
  const diff = Math.max(0, endsAt - Date.now())
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { days, hours, minutes, seconds }
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative min-w-[44px] h-11 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center overflow-hidden">
        <motion.span
          key={value}
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="text-lg font-bold font-mono text-foreground"
        >
          {String(value).padStart(2, '0')}
        </motion.span>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{label}</span>
    </div>
  )
}

export function PrizePoolCard() {
  const prizePool = useAppStore((state) => state.prizePool)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const [time, setTime] = useState(formatTimeLeft(prizePool.endsAt))

  useEffect(() => {
    const id = setInterval(() => setTime(formatTimeLeft(prizePool.endsAt)), 1000)
    return () => clearInterval(id)
  }, [prizePool.endsAt])

  const top3Prizes = prizePool.distribution.slice(0, 3)

  return (
    <GlassCard glow="gold" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-neon-gold/8 via-transparent to-neon-cyan/5 pointer-events-none" />

      {/* Ambient glow */}
      <motion.div
        className="absolute -top-10 -right-10 size-32 rounded-full bg-neon-gold/15 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-col gap-4">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-neon-gold/20 border border-neon-gold/40 flex items-center justify-center">
              <Trophy className="size-4 text-neon-gold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide leading-none mb-0.5">Season {prizePool.season}</p>
              <p className="font-semibold text-foreground text-sm leading-none">Weekly Tournament</p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className="flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors"
          >
            View ranks
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* Prize pool amount */}
        <div className="flex items-center gap-2">
          <Gem className="size-5 text-neon-cyan shrink-0" />
          <NeonText glow="gold" className="text-3xl font-bold font-mono leading-none">
            {prizePool.totalTon.toLocaleString()}
          </NeonText>
          <span className="text-base text-muted-foreground font-medium self-end pb-0.5">TON</span>
        </div>

        {/* Top 3 inline prizes */}
        <div className="flex gap-2">
          {top3Prizes.map((prize, i) => {
            const colors = [
              { text: 'text-neon-gold', bg: 'bg-neon-gold/15', border: 'border-neon-gold/40' },
              { text: 'text-foreground', bg: 'bg-muted/30', border: 'border-border/40' },
              { text: 'text-neon-pink', bg: 'bg-neon-pink/15', border: 'border-neon-pink/40' },
            ]
            const c = colors[i]
            return (
              <div key={prize.rank} className={`flex-1 rounded-lg px-2 py-2 text-center border ${c.bg} ${c.border}`}>
                <p className="text-[10px] text-muted-foreground mb-0.5">#{prize.rank}</p>
                <p className={`text-sm font-bold font-mono leading-none ${c.text}`}>{prize.tonAmount}</p>
                <p className={`text-[10px] ${c.text} opacity-80`}>TON</p>
              </div>
            )
          })}
        </div>

        {/* Countdown */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tournament ends in</span>
          </div>
          <div className="flex items-center gap-2">
            <TimeUnit value={time.days} label="days" />
            <span className="text-muted-foreground font-bold text-lg mb-4">:</span>
            <TimeUnit value={time.hours} label="hrs" />
            <span className="text-muted-foreground font-bold text-lg mb-4">:</span>
            <TimeUnit value={time.minutes} label="min" />
            <span className="text-muted-foreground font-bold text-lg mb-4">:</span>
            <TimeUnit value={time.seconds} label="sec" />
          </div>
        </div>

      </div>
    </GlassCard>
  )
}
