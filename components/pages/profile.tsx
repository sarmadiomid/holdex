'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, User, Wallet, TrendingUp, Trophy, Users, Copy, Check, LogOut, Settings, FileText, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { NeonText } from '@/components/ui/neon-text'
import { useAppStore } from '@/lib/store'
import { useTelegram } from '@/hooks/use-telegram'
import { cn } from '@/lib/utils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

interface ProfileProps {
  onClose: () => void
}

export function Profile({ onClose }: ProfileProps) {
  const { haptic, webApp } = useTelegram()
  const user = useAppStore((state) => state.user)
  const token = useAppStore((state) => state.token)
  const [copied, setCopied] = useState(false)
  const [referralStats, setReferralStats] = useState<{
    referralCount: number
    totalEarned: number
    inviteProgress: number
    inviteRequired: number
    inviteTaskCompleted: boolean
  } | null>(null)

  const referralLink = `https://t.me/zollartest_bot/zollar?startapp=${user.telegramId}`

  useEffect(() => {
    const fetchReferralStats = async () => {
      if (!token) return
      try {
        const res = await fetch(`${BACKEND_URL}/api/referral/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setReferralStats(data)
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchReferralStats()
  }, [token])

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    haptic.notification('success')
    setTimeout(() => setCopied(false), 2000)
  }

  const stats = [
    { label: 'Balance', value: `${user.balance.toLocaleString()} ZLR`, icon: Wallet, color: 'text-neon-cyan' },
    { label: 'Portfolio', value: `${user.portfolioValue.toLocaleString()} ZLR`, icon: TrendingUp, color: 'text-neon-gold' },
    { label: 'Total P&L', value: `${user.totalPnl >= 0 ? '+' : ''}${user.totalPnl.toLocaleString()} ZLR`, icon: TrendingUp, color: user.totalPnl >= 0 ? 'text-neon-green' : 'text-neon-pink' },
    { label: 'Leverage', value: `${user.leverage}x`, icon: Settings, color: 'text-neon-pink' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="absolute inset-x-0 bottom-0 top-16 bg-background rounded-t-3xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 glass border-b border-glass-border px-4 py-4 flex items-center justify-between">
          <NeonText glow="cyan" className="text-xl font-bold">
            Profile
          </NeonText>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* User Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-20 rounded-full bg-gradient-to-br from-neon-cyan to-neon-pink flex items-center justify-center">
                  {user.photoUrl ? (
                    <Image src={user.photoUrl} alt={user.firstName} width={80} height={80} className="size-full rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-background">
                      {user.firstName?.charAt(0)?.toUpperCase() ?? '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {user.firstName} {user.lastName}
                  </h2>
                  {user.username && (
                    <p className="text-muted-foreground">@{user.username}</p>
                  )}
                  {user.rank && (
                    <div className="flex items-center gap-1 mt-1">
                      <Trophy className="size-4 text-neon-gold" />
                      <span className="text-sm font-medium text-neon-gold">Rank #{user.rank}</span>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            {stats.map((stat, index) => (
              <GlassCard key={stat.label} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn('size-4', stat.color)} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className={cn('text-lg font-bold font-mono', stat.color)}>
                  {stat.value}
                </p>
              </GlassCard>
            ))}
          </motion.div>

           {/* Referral Section */}
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
           >
             <GlassCard className="p-5">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <Users className="size-5 text-neon-cyan" />
                   <h3 className="font-semibold text-foreground">Invite Friends</h3>
                 </div>
                 {referralStats && (
                   <div className="text-right">
                     <p className="text-xs text-muted-foreground">Referred</p>
                     <p className="text-lg font-bold text-neon-cyan">{referralStats.referralCount}</p>
                   </div>
                 )}
               </div>
               <p className="text-sm text-muted-foreground mb-2">
                 Earn <span className="text-neon-gold font-bold">10 ZLR</span> for each friend who joins with your link
               </p>
               {referralStats && referralStats.totalEarned > 0 && (
                 <div className="mb-4 px-3 py-2 rounded-lg bg-neon-gold/10 border border-neon-gold/30">
                   <p className="text-sm text-neon-gold font-medium">
                     Total earned: <span className="font-bold">{referralStats.totalEarned} ZLR</span>
                   </p>
                 </div>
               )}

               {/* Invite Task Progress */}
               {referralStats && (
                 <div className={cn(
                   "mb-4 p-3 rounded-lg border",
                   referralStats.inviteTaskCompleted
                     ? "bg-neon-cyan/10 border-neon-cyan/30"
                     : "bg-muted/40 border-border/40"
                 )}>
                   <div className="flex items-center justify-between mb-2">
                     <p className="text-sm font-medium text-foreground">Invite 5 Friends Task</p>
                     {referralStats.inviteTaskCompleted ? (
                       <span className="text-xs text-neon-cyan font-bold">Completed</span>
                     ) : (
                       <span className="text-xs text-muted-foreground">
                         {referralStats.inviteProgress}/{referralStats.inviteRequired}
                       </span>
                     )}
                   </div>
                   <div className="w-full h-2 rounded-full bg-background/50 overflow-hidden">
                     <div
                       className={cn(
                         "h-full rounded-full transition-all duration-500",
                         referralStats.inviteTaskCompleted ? "bg-neon-cyan w-full" : "bg-neon-gold",
                       )}
                       style={{ width: `${referralStats.inviteTaskCompleted ? 100 : (referralStats.inviteProgress / referralStats.inviteRequired) * 100}%` }}
                     />
                   </div>
                   {!referralStats.inviteTaskCompleted && (
                     <p className="text-xs text-muted-foreground mt-2">
                       Earn <span className="text-neon-gold font-bold">2500 ZLR</span> when completed
                     </p>
                   )}
                   {referralStats.inviteTaskCompleted && (
                     <p className="text-xs text-neon-cyan mt-2 font-medium">
                       +2500 ZLR has been added to your balance
                     </p>
                   )}
                 </div>
               )}

               <div className="flex gap-2">
                 <div className="flex-1 px-3 py-2 rounded-lg bg-muted/40 border border-border/40 text-sm font-mono text-foreground truncate">
                   {referralLink}
                 </div>
                 <Button
                   onClick={handleCopyReferral}
                   className="flex-shrink-0"
                   variant={copied ? 'default' : 'outline'}
                 >
                   {copied ? (
                     <>
                       <Check className="size-4 mr-2" />
                       Copied
                     </>
                   ) : (
                     <>
                       <Copy className="size-4 mr-2" />
                       Copy
                     </>
                   )}
                 </Button>
               </div>
             </GlassCard>
           </motion.div>

          {/* Performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="size-5 text-neon-gold" />
                <h3 className="font-semibold text-foreground">Performance</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">P&L Percentage</span>
                  <span className={cn(
                    'text-sm font-bold font-mono',
                    user.totalPnlPercent >= 0 ? 'text-neon-green' : 'text-neon-pink'
                  )}>
                    {user.totalPnlPercent >= 0 ? '+' : ''}{user.totalPnlPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Portfolio Value</span>
                  <span className="text-sm font-bold font-mono text-neon-cyan">
                    {user.portfolioValue.toLocaleString()} ZLR
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Available Balance</span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {user.balance.toLocaleString()} ZLR
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3 pb-6"
          >
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                haptic.impact('light')
                onClose()
                window.location.href = '/policy'
              }}
            >
              <FileText className="size-4 mr-2" />
              Privacy & Terms
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                haptic.impact('light')
                onClose()
                window.location.href = '/security'
              }}
            >
              <Shield className="size-4 mr-2" />
              Security Policy
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-neon-pink border-neon-pink/30 hover:bg-neon-pink/10"
              onClick={() => {
                haptic.impact('medium')
                if (webApp) {
                  webApp.close()
                }
              }}
            >
              <LogOut className="size-4 mr-2" />
              Close App
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
