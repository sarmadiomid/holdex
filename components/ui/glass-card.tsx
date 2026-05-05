'use client'

import { cn } from '@/lib/utils'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  glow?: 'cyan' | 'pink' | 'green' | 'gold' | 'none'
  hover?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, glow = 'none', hover = false, ...props }, ref) => {
    const glowClasses = {
      cyan: 'neon-glow-cyan',
      pink: 'neon-glow-pink',
      green: 'neon-glow-green',
      gold: 'neon-glow-gold',
      none: ''
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'glass rounded-xl p-4',
          glowClasses[glow],
          hover && 'transition-all duration-300 hover:scale-[1.02]',
          className
        )}
        whileTap={hover ? { scale: 0.98 } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

GlassCard.displayName = 'GlassCard'
