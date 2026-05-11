'use client'

import { cn } from '@/lib/utils'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, type Ref } from 'react'

interface NeonTextProps extends Omit<HTMLMotionProps<'span'>, 'ref'> {
  glow?: 'cyan' | 'pink' | 'green' | 'gold' | 'none'
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p'
  animate?: boolean
}

const glowClasses = {
  cyan: 'text-neon-cyan text-glow-cyan',
  pink: 'text-neon-pink text-glow-pink',
  green: 'text-neon-green text-glow-green',
  gold: 'text-neon-gold text-glow-gold',
  none: '',
}

export const NeonText = forwardRef(function NeonText(
  { className, children, glow = 'cyan', as = 'span', animate = false, ...props }: NeonTextProps,
  ref: Ref<HTMLSpanElement>,
) {
  const Component = motion[as] as any

  return (
    <Component
      ref={ref}
      className={cn(glowClasses[glow], className)}
      animate={animate ? {
        textShadow: [
          '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor',
          '0 0 15px currentColor, 0 0 30px currentColor, 0 0 45px currentColor',
          '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor'
        ]
      } : undefined}
      transition={animate ? { duration: 2, repeat: Infinity } : undefined}
      {...props}
    >
      {children}
    </Component>
  )
})

NeonText.displayName = 'NeonText'
