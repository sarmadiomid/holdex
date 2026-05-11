'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Header } from '@/components/navigation/header'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { Dashboard } from '@/components/pages/dashboard'
import { Allocate } from '@/components/pages/allocate'
import { StorePage } from '@/components/pages/store'
import { Leaderboard } from '@/components/pages/leaderboard'
import { EarnPage } from '@/components/pages/earn'
import { Profile } from '@/components/pages/profile'
import { OnboardingTour } from '@/components/onboarding-tour'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { useSocket } from '@/hooks/use-socket'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

if (typeof window !== 'undefined') {
  console.log('[app] NEXT_PUBLIC_BACKEND_URL:', process.env.NEXT_PUBLIC_BACKEND_URL)
  console.log('[app] Resolved BACKEND_URL:', BACKEND_URL)
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

function LoadingScreen() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const duration = 600
    const animate = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(eased * 100)
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-12">
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="relative">
          <motion.div
            className="size-24 rounded-3xl gradient-neon flex items-center justify-center"
            animate={{
              boxShadow: [
                '0 0 32px rgba(0,255,255,0.4)',
                '0 0 64px rgba(0,255,255,0.6)',
                '0 0 32px rgba(0,255,255,0.4)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-5xl font-bold text-background">H</span>
          </motion.div>
          <motion.div
            className="absolute -bottom-1 -right-1 size-6 rounded-full bg-neon-gold flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Sparkles className="size-3 text-background" />
          </motion.div>
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">Holdex</h1>
          <p className="text-sm text-muted-foreground mt-2">Investment tournament simulator</p>
        </div>
      </motion.div>

      <motion.div
        className="w-full max-w-xs"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-gold"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-neon-cyan"
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-xs text-muted-foreground">
            {progress < 30 ? 'Connecting...' : progress < 60 ? 'Loading data...' : progress < 90 ? 'Almost ready...' : 'Starting...'}
          </span>
        </div>
      </motion.div>

      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-8 rounded-full bg-gradient-to-b from-neon-cyan/60 to-neon-cyan/20"
            animate={{
              scaleY: [0.4, 1, 0.4],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
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
  const [showProfile, setShowProfile] = useState(false)

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
    return <LoadingScreen />
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
      <Header onProfileClick={() => setShowProfile(true)} />

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
            {activeTab === 'earn' && <EarnPage />}
            {activeTab === 'store' && <StorePage />}
            {activeTab === 'leaderboard' && <Leaderboard />}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav />

      <AnimatePresence>
        {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      <OnboardingTour />
    </div>
  )
}
