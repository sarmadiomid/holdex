'use client'

import { motion } from 'framer-motion'
import { LayoutDashboard, PieChart, Store, Trophy, Coins } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { cn } from '@/lib/utils'

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'allocate' as const, label: 'Allocate', icon: PieChart },
  { id: 'earn' as const, label: 'Earn', icon: Coins },
  { id: 'store' as const, label: 'Store', icon: Store },
  { id: 'leaderboard' as const, label: 'Rankings', icon: Trophy }
]

export function BottomNav() {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const { haptic } = useTelegram()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-glass-border safe-area-pb">
      <div className="flex items-center justify-around px-2 py-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <motion.button
              key={item.id}
              onClick={() => {
                haptic.selection()
                setActiveTab(item.id)
              }}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors flex-1',
                isActive ? 'text-neon-cyan' : 'text-muted-foreground'
              )}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-neon-cyan/10 rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <Icon className={cn('relative z-10 size-5', isActive && 'text-glow-cyan')} />
              <span className={cn(
                'relative z-10 text-xs font-medium whitespace-nowrap',
                isActive && 'text-glow-cyan'
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
