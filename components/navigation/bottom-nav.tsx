'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutDashboard, PieChart, Store, Trophy, Coins } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { cn } from '@/lib/utils'

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, tourSelector: 'nav-dashboard' },
  { id: 'allocate' as const, label: 'Allocate', icon: PieChart, tourSelector: 'nav-allocate' },
  { id: 'earn' as const, label: 'Earn', icon: Coins, tourSelector: 'nav-earn' },
  { id: 'store' as const, label: 'Store', icon: Store, tourSelector: 'nav-store' },
  { id: 'leaderboard' as const, label: 'Rankings', icon: Trophy, tourSelector: 'nav-leaderboard' }
]

export function BottomNav() {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const { haptic } = useTelegram()
  const [tourHighlightTab, setTourHighlightTab] = useState<string | null>(null)

  useEffect(() => {
    const handleTourHighlight = (e: CustomEvent<{ tab: string | null }>) => {
      setTourHighlightTab(e.detail.tab)
    }
    window.addEventListener('tourHighlight' as any, handleTourHighlight)
    return () => window.removeEventListener('tourHighlight' as any, handleTourHighlight)
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-glass-border safe-area-pb">
      <div className="flex items-center justify-around px-2 py-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const isHighlighted = tourHighlightTab === item.id
          const Icon = item.icon

          return (
            <motion.button
              key={item.id}
              data-tour={item.tourSelector}
              onClick={() => {
                haptic.selection()
                setActiveTab(item.id)
              }}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors flex-1',
                isActive ? 'text-neon-cyan' : 'text-muted-foreground',
                isHighlighted && 'text-neon-cyan'
              )}
              animate={isHighlighted ? { scale: 1.1 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              {isActive || isHighlighted ? (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-neon-cyan/10 rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              ) : null}
              <Icon className={cn(
                'relative z-10 size-5 transition-all',
                isActive && 'text-glow-cyan',
                isHighlighted && 'brightness-150 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]'
              )} />
              <span className={cn(
                'relative z-10 text-xs font-medium whitespace-nowrap transition-all',
                isActive && 'text-glow-cyan',
                isHighlighted && 'brightness-150 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]'
              )}>
                {item.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
