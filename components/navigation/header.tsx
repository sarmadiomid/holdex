'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { NeonText } from '@/components/ui/neon-text'
import { Wallet } from 'lucide-react'

export function Header() {
  const user = useAppStore((state) => state.user)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-glass-border safe-area-pt">
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-neon-cyan/30">
            <Wallet className="size-4 text-neon-cyan" />
            <span className="text-sm font-mono font-medium text-foreground">
              {user.balance.toLocaleString()}
            </span>
            <span className="text-xs text-neon-cyan font-medium">HLX</span>
          </div>
          
          <div className="size-9 rounded-full bg-gradient-to-br from-neon-cyan to-neon-pink flex items-center justify-center">
            <span className="text-sm font-bold text-background">
              {user.firstName.charAt(0).toUpperCase()}
            </span>
          </div>
        </motion.div>
      </div>
    </header>
  )
}
