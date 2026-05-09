'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Clock, Gem, ChevronRight, Pause, Play } from 'lucide-react'
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

function TimeUnit({ value, label, dimmed = false }: { value: number; label: string; dimmed?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`relative min-w-[44px] h-11 rounded-xl border flex items-center justify-center overflow-hidden ${dimmed ? 'bg-muted/20 border-border/20' : 'bg-muted/40 border-border/40'}`}>
        <motion.span
          key={value}
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`text-lg font-bold font-mono ${dimmed ? 'text-muted-foreground/50' : 'text-foreground'}`}
        >
          {String(value).padStart(2, '0')}
        </motion.span>
      </div>
      <span className={`text-[10px] mt-1 uppercase tracking-wide ${dimmed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  )
}

export function PrizePoolCard() {
  const prizePool = useAppStore((state) => state.prizePool)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  
  const isCooldown = prizePool.phase === 'cooldown'
  const targetTime = isCooldown ? prizePool.nextPhaseStartsAt : prizePool.endsAt
  
  const [time, setTime] = useState(formatTimeLeft(targetTime))

  useEffect(() => {
    const id = setInterval(() => setTime(formatTimeLeft(targetTime)), 1000)
    return () => clearInterval(id)
  }, [targetTime])

  const top3Prizes = prizePool.distribution.slice(0, 3)

  return (
    <GlassCard glow={isCooldown ? 'none' : 'gold'} className={`relative overflow-hidden ${isCooldown ? 'opacity-80' : ''}`}>
      <div className={`absolute inset-0 pointer-events-none ${isCooldown ? 'bg-gradient-to-br from-muted/20 via-transparent to-muted/10' : 'bg-gradient-to-br from-neon-gold/8 via-transparent to-neon-cyan/5'}`} />

      {!isCooldown && (
        <motion.div
          className="absolute -top-10 -right-10 size-32 rounded-full bg-neon-gold/15 blur-3xl pointer-events-none"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative flex flex-col gap-4">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`size-9 rounded-xl border flex items-center justify-center ${isCooldown ? 'bg-muted/20 border-border/40' : 'bg-neon-gold/20 border-neon-gold/40'}`}>
              {isCooldown ? (
                <Pause className="size-4 text-muted-foreground" />
              ) : (
                <Trophy className="size-4 text-neon-gold" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide leading-none mb-0.5">Season {prizePool.season}</p>
              <p className={`font-semibold text-sm leading-none ${isCooldown ? 'text-muted-foreground' : 'text-foreground'}`}>
                {isCooldown ? 'Tournament Ended' : 'Weekly Tournament'}
              </p>
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
          <Gem className={`size-5 shrink-0 ${isCooldown ? 'text-muted-foreground/50' : 'text-neon-cyan'}`} />
          <NeonText glow={isCooldown ? 'none' : 'gold'} className={`text-3xl font-bold font-mono leading-none ${isCooldown ? 'text-muted-foreground/70' : ''}`}>
            {prizePool.totalTon.toLocaleString()}
          </NeonText>
          <span className={`text-base font-medium self-end pb-0.5 ${isCooldown ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>TON</span>
        </div>

        {/* Top 3 inline prizes */}
        <div className="flex gap-2">
          {top3Prizes.map((prize, i) => {
            const colors = isCooldown ? [
              { text: 'text-muted-foreground/50', bg: 'bg-muted/10', border: 'border-border/20' },
              { text: 'text-muted-foreground/40', bg: 'bg-muted/10', border: 'border-border/20' },
              { text: 'text-muted-foreground/30', bg: 'bg-muted/10', border: 'border-border/20' },
            ] : [
              { text: 'text-neon-gold', bg: 'bg-neon-gold/15', border: 'border-neon-gold/40' },
              { text: 'text-foreground', bg: 'bg-muted/30', border: 'border-border/40' },
              { text: 'text-neon-pink', bg: 'bg-neon-pink/15', border: 'border-neon-pink/40' },
            ]
            const c = colors[i]
            return (
              <div key={prize.rank} className={`flex-1 rounded-lg px-2 py-2 text-center border ${c.bg} ${c.border}`}>
                <p className={`text-[10px] mb-0.5 ${isCooldown ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>#{prize.rank}</p>
                <p className={`text-sm font-bold font-mono leading-none ${c.text}`}>{prize.tonAmount}</p>
                <p className={`text-[10px] ${c.text}`}>TON</p>
              </div>
            )
          })}
        </div>

        {/* Countdown */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className={`size-3.5 ${isCooldown ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
            <span className={`text-xs ${isCooldown ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
              {isCooldown ? (
                <>Tournament starts in</>
              ) : (
                <>Tournament ends in</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TimeUnit value={time.days} label="days" dimmed={isCooldown} />
            <span className={`font-bold text-lg mb-4 ${isCooldown ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>:</span>
            <TimeUnit value={time.hours} label="hrs" dimmed={isCooldown} />
            <span className={`font-bold text-lg mb-4 ${isCooldown ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>:</span>
            <TimeUnit value={time.minutes} label="min" dimmed={isCooldown} />
            <span className={`font-bold text-lg mb-4 ${isCooldown ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}>:</span>
            <TimeUnit value={time.seconds} label="sec" dimmed={isCooldown} />
          </div>
        </div>

        {/* Cooldown message */}
        {isCooldown && (
          <div className="mt-2 p-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/20">
            <div className="flex items-center gap-2 text-neon-cyan/80">
              <Play className="size-4" />
              <span className="text-xs">Prizes are being distributed. Get ready for the next tournament!</span>
            </div>
          </div>
        )}

      </div>
    </GlassCard>
  )
}
