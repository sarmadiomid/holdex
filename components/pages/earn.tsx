'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, CheckCircle, Loader2, Coins, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { cn } from '@/lib/utils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export function EarnPage() {
  const { haptic, webApp } = useTelegram()
  const earnTasks = useAppStore((state) => state.earnTasks)
  const completeTask = useAppStore((state) => state.completeTask)
  const token = useAppStore((state) => state.token)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const completedCount = earnTasks.filter((t) => t.completed).length
  const totalRewards = earnTasks.reduce((sum, t) => sum + (t.completed ? t.reward : 0), 0)
  const availableRewards = earnTasks.reduce((sum, t) => sum + (!t.completed ? t.reward : 0), 0)

  const handleTaskClick = async (task: typeof earnTasks[0]) => {
    if (task.completed || processingId) return
    
    haptic.impact('medium')
    setProcessingId(task.id)

    // Open URL if exists
    if (task.url) {
      if (webApp && (webApp as any).openLink) {
        ;(webApp as any).openLink(task.url)
      } else {
        window.open(task.url, '_blank')
      }
    }

    // Simulate verification delay
    setTimeout(async () => {
      try {
        if (token) {
          const res = await fetch(`${BACKEND_URL}/api/earn/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ taskId: task.id }),
          })

          if (res.ok) {
            const data = await res.json()
            completeTask(task.id)
            haptic.notification('success')
          } else {
            haptic.notification('error')
          }
        } else {
          // Fallback for non-authenticated users
          completeTask(task.id)
          haptic.notification('success')
        }
      } catch (error) {
        console.error('Task completion error:', error)
        // Still complete locally on error
        completeTask(task.id)
        haptic.notification('success')
      } finally {
        setProcessingId(null)
      }
    }, 2000)
  }

  return (
    <div className="space-y-6 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="flex items-center justify-center gap-2">
          <Gift className="size-8 text-neon-gold" />
          <NeonText glow="gold" className="text-3xl font-bold">
            Earn Free HLX
          </NeonText>
        </div>
        <p className="text-muted-foreground text-sm">
          Complete tasks to earn HLX tokens
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="p-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-neon-cyan">{completedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-neon-gold">{totalRewards.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Earned HLX</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-neon-pink">{availableRewards.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <div className="space-y-3">
        {earnTasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
          >
            <GlassCard
              className={cn(
                'p-4 transition-all',
                task.completed && 'opacity-60',
                !task.completed && 'hover:border-neon-cyan/50 cursor-pointer'
              )}
              onClick={() => !task.completed && handleTaskClick(task)}
            >
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-gradient-to-br from-neon-cyan/20 to-neon-pink/20 flex items-center justify-center text-2xl flex-shrink-0">
                  {task.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground mb-1">{task.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-neon-gold/20 border border-neon-gold/40">
                      <Coins className="size-3 text-neon-gold" />
                      <span className="text-xs font-bold text-neon-gold">+{task.reward.toLocaleString()}</span>
                    </div>
                    
                    {task.type === 'follow' && (
                      <span className="text-xs text-muted-foreground">Follow</span>
                    )}
                    {task.type === 'watch' && (
                      <span className="text-xs text-muted-foreground">Watch</span>
                    )}
                    {task.type === 'visit' && (
                      <span className="text-xs text-muted-foreground">Visit</span>
                    )}
                    {task.type === 'share' && (
                      <span className="text-xs text-muted-foreground">Share</span>
                    )}
                    {task.type === 'invite' && (
                      <span className="text-xs text-muted-foreground">Invite</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {task.completed ? (
                    <div className="size-10 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                      <CheckCircle className="size-5 text-neon-cyan" />
                    </div>
                  ) : processingId === task.id ? (
                    <div className="size-10 rounded-full bg-neon-gold/20 flex items-center justify-center">
                      <Loader2 className="size-5 text-neon-gold animate-spin" />
                    </div>
                  ) : (
                    <div className="size-10 rounded-full bg-muted/40 flex items-center justify-center">
                      <ExternalLink className="size-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {completedCount === earnTasks.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <div className="size-16 rounded-full bg-gradient-to-br from-neon-cyan to-neon-gold mx-auto mb-4 flex items-center justify-center">
            <CheckCircle className="size-8 text-background" />
          </div>
          <NeonText glow="cyan" className="text-xl font-bold mb-2">
            All Tasks Completed!
          </NeonText>
          <p className="text-muted-foreground text-sm">
            You've earned {totalRewards.toLocaleString()} HLX tokens
          </p>
        </motion.div>
      )}
    </div>
  )
}
