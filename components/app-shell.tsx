'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gem, Clock } from 'lucide-react'
import { Header } from '@/components/navigation/header'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { Dashboard } from '@/components/pages/dashboard'
import { Allocate } from '@/components/pages/allocate'
import { StorePage } from '@/components/pages/store'
import { Leaderboard } from '@/components/pages/leaderboard'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { useSocket } from '@/hooks/use-socket'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

if (typeof window !== 'undefined') {
  console.log('[app] NEXT_PUBLIC_BACKEND_URL:', process.env.NEXT_PUBLIC_BACKEND_URL)
  console.log('[app] Resolved BACKEND_URL:', BACKEND_URL)
}

function useLandingCountdown(endsAt: number) {
  const calc = () => {
    const diff = Math.max(0, endsAt - Date.now())
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }
  const [t, setT] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  })
  return t
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

function LandingScreen() {
  const prizePool = useAppStore((state) => state.prizePool)
  const t = useLandingCountdown(prizePool.endsAt)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-10">
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          className="size-20 rounded-3xl gradient-neon flex items-center justify-center"
          animate={{
            boxShadow: [
              '0 0 24px rgba(0,255,255,0.35)',
              '0 0 48px rgba(0,255,255,0.55)',
              '0 0 24px rgba(0,255,255,0.35)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-4xl font-bold text-background">H</span>
        </motion.div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Holdex</h1>
          <p className="text-sm text-muted-foreground mt-1">Investment tournament simulator</p>
        </div>
      </motion.div>

      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="glass rounded-2xl p-5 border border-neon-gold/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Season {prizePool.season}</p>
              <p className="font-semibold text-foreground">Weekly Tournament</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-gold/20 border border-neon-gold/40">
              <Gem className="size-3.5 text-neon-cyan" />
              <span className="text-sm font-bold font-mono text-neon-gold">{prizePool.totalTon} TON</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="size-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Tournament ends in</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { value: t.days, label: 'Days' },
              { value: t.hours, label: 'Hours' },
              { value: t.minutes, label: 'Mins' },
              { value: t.seconds, label: 'Secs' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-full h-14 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center">
                  <motion.span
                    key={value}
                    initial={{ y: -8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl font-bold font-mono text-foreground"
                  >
                    {String(value).padStart(2, '0')}
                  </motion.span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { rank: '1st', prize: prizePool.distribution[0]?.tonAmount, color: 'text-neon-gold', bg: 'bg-neon-gold/15 border-neon-gold/40' },
              { rank: '2nd', prize: prizePool.distribution[1]?.tonAmount, color: 'text-foreground', bg: 'bg-muted/30 border-border/40' },
              { rank: '3rd', prize: prizePool.distribution[2]?.tonAmount, color: 'text-neon-pink', bg: 'bg-neon-pink/15 border-neon-pink/40' },
            ].map(({ rank, prize, color, bg }) => (
              <div key={rank} className={`rounded-xl p-2 text-center border ${bg}`}>
                <p className="text-[10px] text-muted-foreground">{rank}</p>
                <p className={`text-sm font-bold font-mono ${color}`}>{prize}</p>
                <p className={`text-[10px] ${color} opacity-70`}>TON</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.p
        className="text-xs text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Connecting to Holdex...
      </motion.p>
    </div>
  )
}

export function AppShell() {
  const activeTab = useAppStore((state) => state.activeTab)
  const token = useAppStore((state) => state.token)
  const isAuthenticated = useAppStore((state) => state.isAuthenticated)
  const { webApp, isReady, isTelegram } = useTelegram()
  const [authenticating, setAuthenticating] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useSocket({ token, enabled: !!token && isAuthenticated })

  useEffect(() => {
    if (!isReady) return

    const authenticate = async () => {
      try {
        let initData: string | null = null

        if (isTelegram && webApp) {
          initData = webApp.initData
        }

        if (!initData) {
          console.log('[auth] Running outside Telegram — no auth possible')
          setAuthenticating(false)
          return
        }

        const res = await fetch(`${BACKEND_URL}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        })

        if (!res.ok) {
          const err = await res.json()
          setAuthError(err.error || 'Authentication failed')
          setAuthenticating(false)
          return
        }

        const data = await res.json()
        useAppStore.getState().setAuthenticatedUser(data.user, data.token)
      } catch (err) {
        console.error('[auth] Error:', err)
        setAuthError('Connection to server failed')
      } finally {
        setAuthenticating(false)
      }
    }

    authenticate()
  }, [isReady, isTelegram, webApp])

  if (!isReady || authenticating) {
    return <LandingScreen />
  }

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <motion.div
          className="size-20 rounded-3xl gradient-neon flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-4xl font-bold text-background">H</span>
        </motion.div>
        <p className="text-neon-pink text-sm text-center">{authError}</p>
        <p className="text-muted-foreground text-xs text-center">Please try again later</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <motion.div
          className="size-20 rounded-3xl gradient-neon flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-4xl font-bold text-background">H</span>
        </motion.div>
        <p className="text-muted-foreground text-sm text-center">Open this app via Telegram to start playing</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16 pb-24 px-4 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'allocate' && <Allocate />}
            {activeTab === 'store' && <StorePage />}
            {activeTab === 'leaderboard' && <Leaderboard />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
