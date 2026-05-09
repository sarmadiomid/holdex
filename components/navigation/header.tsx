'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { NeonText } from '@/components/ui/neon-text'
import { Wallet } from 'lucide-react'
import { useTelegram } from '@/hooks/use-telegram'

interface HeaderProps {
  onProfileClick: () => void
}

export function Header({ onProfileClick }: HeaderProps) {
  const user = useAppStore((state) => state.user)
  const { haptic } = useTelegram()

  return (
    <header data-tour="header" className="fixed top-0 left-0 right-0 z-50 glass border-b border-glass-border safe-area-pt">
      <div className="flex items-center justify-between px-4 py-3">
        <motion.div 
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="size-8 rounded-lg gradient-neon flex items-center justify-center">
            <span className="text-lg font-bold text-background">H</span>
          </div>
          <NeonText glow="cyan" className="text-xl font-bold tracking-tight">
            HOLDEX
          </NeonText>
        </motion.div>

        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div data-tour="portfolio" className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-neon-cyan/30">
            <Wallet className="size-4 text-neon-cyan" />
            <span className="text-sm font-mono font-medium text-foreground">
              {user.portfolioValue.toLocaleString()}
            </span>
            <span className="text-xs text-neon-cyan font-medium">HLX</span>
          </div>
          
          <motion.button
            onClick={() => {
              haptic.impact('light')
              onProfileClick()
            }}
            whileTap={{ scale: 0.9 }}
            className="size-9 rounded-full bg-gradient-to-br from-neon-cyan to-neon-pink flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-neon-cyan/20 transition-shadow"
          >
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.firstName} className="size-full rounded-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-background">
                {user.firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </motion.button>
        </motion.div>
      </div>
    </header>
  )
}
