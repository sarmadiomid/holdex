'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, FileText, Scale, Eye } from 'lucide-react'
import Link from 'next/link'
import { NeonText } from '@/components/ui/neon-text'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { useTelegram } from '@/hooks/use-telegram'

const sections = [
  {
    id: 'privacy',
    icon: Eye,
    glow: 'cyan' as const,
    title: 'Privacy Policy',
    content: [
      {
        sub: 'Information We Collect',
        body: 'When you access Zollar via Telegram, we collect the following data through Telegram\'s authentication system: your Telegram user ID, username, first name, last name, and profile photo URL. This information is provided to us by Telegram when you authorize the Mini App and is validated using HMAC-SHA256 cryptographic verification to ensure authenticity.',
      },
      {
        sub: 'Financial Simulation Data',
        body: 'We store your in-app balance, portfolio allocations, trading history, position records, and performance metrics (profit/loss, portfolio value, leverage settings). This data is used solely to operate the investment simulation and weekly tournament leaderboard.',
      },
      {
        sub: 'Referral Data',
        body: 'If you use a referral link, we record which user referred you and track referral counts for reward distribution. Self-referrals and duplicate referrals are blocked at the database level.',
      },
      {
        sub: 'How We Use Your Data',
        body: 'Your data is used to: (a) authenticate you via Telegram, (b) operate the simulated trading platform and leaderboard, (c) process Telegram Stars purchases, (d) distribute referral rewards, (e) display rankings and usernames on the public leaderboard, (f) improve platform functionality and detect abuse.',
      },
      {
        sub: 'Data Sharing',
        body: 'We do not sell, rent, or share your personal data with third parties. Your Telegram username and profile photo may be visible to other users on the leaderboard. Payment transactions are processed through Telegram\'s Stars infrastructure — we do not store payment card details.',
      },
      {
        sub: 'Data Retention',
        body: 'We retain your data for as long as your account is active. You may request deletion of your account and associated data by contacting us. Leaderboard archives and anonymized aggregated data may be retained for historical purposes.',
      },
      {
        sub: 'Third-Party Services',
        body: 'Zollar integrates with: (1) Telegram — for authentication, Mini App hosting, and Stars payments, (2) TwelveData — for real-time and historical market price data (BTC/USD, XAU/USD, EUR/USD), (3) MongoDB Atlas — for database hosting, (4) Vercel & Render — for application hosting. Each service has its own privacy policy governing data handling.',
      },
      {
        sub: 'Your Rights',
        body: 'You have the right to access, correct, or delete your personal data. Since Zollar operates through Telegram, you can revoke the Mini App\'s access via your Telegram settings at any time.',
      },
    ],
  },
  {
    id: 'terms',
    icon: Scale,
    glow: 'gold' as const,
    title: 'Terms of Service',
    content: [
      {
        sub: 'Acceptance of Terms',
        body: 'By accessing or using Zollar ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.',
      },
      {
        sub: 'Eligibility',
        body: 'You must be at least 13 years of age (or the age of digital consent in your jurisdiction) to use Zollar. By using the Platform, you represent that you meet this requirement.',
      },
      {
        sub: 'Simulated Environment',
        body: 'Zollar is a gamified investment simulation platform. All assets (BTC, Gold, EUR/USD) are simulated using volatility multipliers for entertainment purposes. ZLR tokens have no real-world value, cannot be exchanged for real currency or cryptocurrency, and do not represent actual ownership of any financial instrument. The platform uses real market data from TwelveData for price reference only.',
      },
      {
        sub: 'No Real Financial Advice',
        body: 'Zollar does not provide financial advice. The simulated trading environment is for entertainment and educational purposes only. Nothing on the Platform constitutes a recommendation to buy, sell, or hold any real-world financial asset.',
      },
      {
        sub: 'Tournament Rules',
        body: 'Weekly tournaments run Monday 00:00 UTC through Friday 23:00 UTC. The weekend (Saturday-Sunday) is a cooldown period where allocations and trading are disabled. Leaderboard rankings are based on portfolio value at the end of each week. Top 3 positions receive a share of the prize pool (500 TON equivalent, simulated or real at our discretion). We reserve the right to modify tournament schedules and prize distributions.',
      },
      {
        sub: 'Fair Play & Prohibited Conduct',
        body: 'You agree not to: (a) exploit bugs or glitches for unfair advantage, (b) create multiple accounts, (c) manipulate the leaderboard through collusion, (d) use automated scripts or bots, (e) engage in any activity that disrupts the Platform\'s operation. Violations may result in account suspension, forfeiture of rewards, or permanent bans.',
      },
      {
        sub: 'Wallet Cap',
        body: 'Your ZLR balance is capped at a maximum of 1,000 ZLR. Any purchases, rewards, or earnings that would exceed this cap will be blocked. This cap ensures fair competition across all participants.',
      },
      {
        sub: 'Telegram Stars Purchases',
        body: 'In-app purchases are processed through Telegram Stars. All sales are final. Refunds are handled exclusively through Telegram\'s payment dispute system. We reserve the right to modify pricing and package offerings at any time.',
      },
      {
        sub: 'Referral Program',
        body: 'Referral rewards (10 ZLR per referred user) and invite task bonuses (2,500 ZLR for referring 5 users) are subject to abuse detection. We reserve the right to withhold rewards if fraudulent activity is detected.',
      },
      {
        sub: 'Limitation of Liability',
        body: 'Zollar and its operators are not liable for any damages arising from your use of the Platform, including but not limited to: loss of simulated funds, data loss, service interruptions, or any indirect or consequential damages. The Platform is provided "as is" without warranties of any kind.',
      },
      {
        sub: 'Modifications',
        body: 'We reserve the right to modify these Terms at any time. Significant changes will be notified through the Platform. Continued use after changes constitutes acceptance of the new Terms.',
      },
      {
        sub: 'Governing Law',
        body: 'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the Platform operator is established. Any disputes shall be resolved through binding arbitration.',
      },
      {
        sub: 'Contact',
        body: 'For questions about these Terms or Privacy Policy, contact us through our official Telegram channel or community group.',
      },
    ],
  },
]

export default function PolicyPage() {
  const { haptic } = useTelegram()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-glass-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => haptic.impact?.('light')}
            >
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg gradient-neon flex items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Zollar" width={32} height={32} className="object-cover" />
            </div>
            <NeonText glow="cyan" className="text-xl font-bold tracking-tight">
              LEGAL
            </NeonText>
          </div>
        </div>
      </header>

      <main className="pt-20 pb-16 px-4 max-w-3xl mx-auto space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="size-16 rounded-2xl gradient-neon flex items-center justify-center mx-auto">
            <FileText className="size-8 text-background" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Privacy Policy & Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Last updated: May 2026. Please read these documents carefully before using Zollar.
          </p>
        </motion.div>

        {/* Sections */}
        {sections.map((section, idx) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.1 }}
          >
            <GlassCard glow={section.glow} className="p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-glass-border pb-4">
                <section.icon className="size-6 text-neon-cyan" />
                <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              </div>

              {section.content.map((item, i) => (
                <div key={i} className="space-y-2">
                  <h3 className="text-sm font-semibold text-neon-cyan uppercase tracking-wider">
                    {item.sub}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </GlassCard>
          </motion.div>
        ))}
      </main>
    </div>
  )
}
