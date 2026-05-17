'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Lock, Key, Server, FileCheck, Webhook, Users } from 'lucide-react'
import Link from 'next/link'
import { NeonText } from '@/components/ui/neon-text'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { useTelegram } from '@/hooks/use-telegram'

const policies = [
  {
    icon: Lock,
    glow: 'cyan' as const,
    title: 'Authentication & Access Control',
    items: [
      {
        label: 'Telegram HMAC-SHA256 Verification',
        desc: 'All authentication requests are verified using HMAC-SHA256 with a 24-hour expiry window. The Telegram bot token is used as the secret key, ensuring only legitimate Telegram Mini App requests are accepted.',
      },
      {
        label: 'JWT Token-Based Sessions',
        desc: 'Authenticated users receive a signed JWT (JSON Web Token) with a 30-day validity period. All API requests are verified against this token. The JWT secret is a cryptographically strong random string (minimum 32 characters).',
      },
      {
        label: 'Rate Limiting',
        desc: 'Multi-layered rate limiting is enforced: general API (100 req/min), authentication (20 req/15min), allocations (10 req/min), and Socket.IO connections rate-limited per IP/token to prevent abuse and brute-force attacks.',
      },
    ],
  },
  {
    icon: Server,
    glow: 'gold' as const,
    title: 'Data Storage & Database Security',
    items: [
      {
        label: 'MongoDB Atlas (Encrypted at Rest)',
        desc: 'User data is stored in MongoDB Atlas with encryption at rest using AES-256. Database access is restricted to authorized IP addresses and authenticated connections. Network isolation is enforced through Atlas network peering and IP access lists.',
      },
      {
        label: 'Connection Pooling & Transactions',
        desc: 'Critical operations — including allocation changes, referral rewards, and sell orders — use MongoDB transactions for atomicity. This ensures that if any step fails, all changes are rolled back, preventing data corruption.',
      },
      {
        label: 'Input Validation (Zod Schemas)',
        desc: 'Every API endpoint validates incoming data using Zod schemas. Malformed or malicious payloads are rejected before reaching any business logic. Request body size is limited to 10KB to prevent large payload attacks.',
      },
    ],
  },
  {
    icon: Key,
    glow: 'pink' as const,
    title: 'Payment Security (Telegram Stars)',
    items: [
      {
        label: 'Webhook Secret Token Verification',
        desc: 'Telegram payment webhooks are validated using a configurable secret token passed via the x-telegram-bot-api-secret-token header. Requests without a valid token are immediately rejected.',
      },
      {
        label: 'Replay Attack Protection',
        desc: 'Each Telegram webhook update includes a unique update_id. Our system tracks processed IDs in a bounded set (up to 10,000 entries) to prevent replay attacks. Duplicate update_ids are silently ignored.',
      },
      {
        label: 'Payload Integrity Verification',
        desc: 'Payment payloads (packageId, telegramId) are embedded in the invoice payload and validated against Zod schemas. Pre-checkout queries are verified before approval. Invalid or tampered payloads are rejected with a descriptive error message.',
      },
    ],
  },
  {
    icon: Shield,
    glow: 'green' as const,
    title: 'Infrastructure & Network Security',
    items: [
      {
        label: 'Helmet Security Headers',
        desc: 'All HTTP responses include security headers via Helmet.js: Content Security Policy (CSP), X-Content-Type-Options (nosniff), X-Frame-Options, and Strict-Transport-Security. CSP restricts script sources and prevents XSS attacks.',
      },
      {
        label: 'CORS Whitelist',
        desc: 'Cross-Origin Resource Sharing is strictly limited to the configured frontend URL and localhost for development. No wildcard origins are permitted. Any request from an unauthorized origin is blocked at the middleware level.',
      },
      {
        label: 'Environment Variable Isolation',
        desc: 'All sensitive configuration — database URIs, API keys, bot tokens, JWT secrets — is managed through environment variables. No secrets are hardcoded in the source code. Production secrets are set through the hosting platform (Vercel, Render).',
      },
    ],
  },
  {
    icon: Webhook,
    glow: 'pink' as const,
    title: 'Real-Time Data & Portfolio Security',
    items: [
      {
        label: 'WebSocket Authentication',
        desc: 'All Socket.IO connections require a valid JWT token. Unauthenticated connections are rejected before joining any room. Users are isolated to their own room (identified by telegramId) and only receive their own portfolio updates.',
      },
      {
        label: 'TwelveData API Key Protection',
        desc: 'Market data API keys are stored as environment variables and never exposed to the client. The WebSocket connection to TwelveData is server-side only — price updates are forwarded to clients through authenticated Socket.IO channels.',
      },
      {
        label: 'Hourly PnL Sync (Cron Job Safety)',
        desc: 'An automated cron job runs hourly to synchronize portfolio calculations using authoritative server-side price data. If a user\'s portfolio value reaches zero, all positions are automatically liquidated and allocations reset. Processing is chunked (50 users at a time) with 100ms delays between chunks to prevent event loop starvation.',
      },
    ],
  },
  {
    icon: Users,
    glow: 'cyan' as const,
    title: 'Data Integrity & Fair Play',
    items: [
      {
        label: 'Self-Referral & Duplicate Prevention',
        desc: 'The referral system includes multi-layer abuse prevention: self-referral blocking (same telegramId), duplicate referral blocking (Mongoose ObjectId comparison), and transaction-based atomicity for reward distribution.',
      },
      {
        label: 'Balance Cap Enforcement',
        desc: 'A maximum balance of 1,000 HLX is enforced at both the API level (purchase validation) and database level. Any operation that would exceed this cap is rejected, ensuring tournament fairness.',
      },
      {
        label: 'Leaderboard Integrity',
        desc: 'Leaderboard rankings are calculated server-side using MongoDB aggregation pipelines. The frontend displays read-only data. All portfolio values and PnL calculations use authoritative server-side price data, not client-reported values.',
      },
      {
        label: 'Secure Session Handling',
        desc: 'User sessions are maintained through Zustand state management with server-side verification on every state-changing operation. The frontend never trusts client-calculated portfolio values for leaderboard or reward purposes.',
      },
    ],
  },
]

export default function SecurityPage() {
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
            <div className="size-8 rounded-lg gradient-neon flex items-center justify-center">
              <span className="text-lg font-bold text-background">H</span>
            </div>
            <NeonText glow="cyan" className="text-xl font-bold tracking-tight">
              SECURITY
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
            <Shield className="size-8 text-background" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Security Policy
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            How Zollar protects your data, maintains platform integrity, and handles security.
          </p>
        </motion.div>

        {/* Vulnerability Disclosure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <GlassCard glow="pink" className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="size-6 text-neon-pink" />
              <h2 className="text-lg font-bold text-foreground">Responsible Disclosure</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you discover a security vulnerability in Zollar, please report it responsibly
              through our official Telegram channel. Do not disclose vulnerabilities publicly
              until they have been addressed. We are committed to resolving validated security
              issues promptly and will acknowledge reports within 48 hours.
            </p>
          </GlassCard>
        </motion.div>

        {/* Policy Sections */}
        {policies.map((section, idx) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + idx * 0.1 }}
          >
            <GlassCard glow={section.glow} className="p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-glass-border pb-4">
                <section.icon className="size-6 text-neon-cyan" />
                <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
              </div>

              <div className="space-y-5">
                {section.items.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="size-2 rounded-full bg-neon-cyan mt-1.5 shrink-0" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {item.label}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-4">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </main>
    </div>
  )
}
