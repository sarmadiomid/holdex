import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import { z } from 'zod'
import { env } from './config/env'
import { logger } from './utils/logger'
import { connectDB } from './db/connect'
import { setupSocketIO, getIo, broadcastAllPrices } from './services/socket'
import { startTwelveData } from './services/twelveData'
import { startLeaderboardCron } from './services/leaderboard'
import { setupTelegramWebhook, getWebhookInfo } from './services/telegram'
import authRoutes from './routes/auth'
import allocationRoutes from './routes/allocation'
import starsRoutes from './routes/stars'
import leaderboardRoutes from './routes/leaderboard'
import earnRoutes from './routes/earn'
import referralRoutes from './routes/referral'
import { generalLimiter } from './middleware/rateLimit'
import { User } from './db/models/User'
import { Position } from './db/models/Position'
import { STARS_PACKAGES } from './routes/stars'

async function bootstrap() {
  await connectDB()

  const app = express()
  const httpServer = http.createServer(app)

  app.use(helmet())

  // CORS: normalize trailing slashes and allow any vercel.app subdomain
  const normalizeOrigin = (url: string) => url.replace(/\/+$/, '')
  const allowedOrigins = [
    normalizeOrigin(env.FRONTEND_URL),
    'http://localhost:3000',
  ]
  if (env.ALLOWED_ORIGINS) {
    allowedOrigins.push(
      ...env.ALLOWED_ORIGINS.split(',').map((s) => normalizeOrigin(s.trim())),
    )
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        const normalized = normalizeOrigin(origin)
        const isAllowed = allowedOrigins.includes(normalized)
        if (isAllowed) {
          callback(null, true)
        } else {
          logger.warn(`CORS blocked origin: ${origin}`)
          callback(null, false)
        }
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '10kb' }))
  app.use(generalLimiter)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() })
  })

  // Telegram webhook endpoint for Stars payment verification
  const WebhookBodySchema = z.object({
    update_id: z.number().int(),
    pre_checkout_query: z.object({
      id: z.string().min(1),
      invoice_payload: z.string().min(1),
    }).optional(),
    message: z.object({
      successful_payment: z.object({
        invoice_payload: z.string().min(1),
        telegram_payment_charge_id: z.string().min(1),
      }).optional(),
    }).optional(),
  })

  const PayloadSchema = z.object({
    packageId: z.string().min(1),
    telegramId: z.number().int(),
  })

  // Track processed update IDs to prevent replay attacks
  const processedUpdateIds = new Set<number>()
  const MAX_PROCESSED_IDS = 10000 // Limit memory usage

  app.post('/telegram-webhook', express.json(), async (req, res) => {
    try {
      // Validate webhook secret token if configured
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const secretToken = req.headers['x-telegram-bot-api-secret-token']
        if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
          logger.warn('Invalid webhook secret token', { 
            receivedToken: secretToken ? '[REDACTED]' : 'none' 
          })
          return res.status(401).json({ error: 'Unauthorized' })
        }
      }

      const parseResult = WebhookBodySchema.safeParse(req.body)
      if (!parseResult.success) {
        logger.warn('Invalid webhook body', { errors: parseResult.error.flatten() })
        return res.json({ ok: true })
      }
      const update = parseResult.data

      // Prevent replay attacks by checking if update_id was already processed
      if (processedUpdateIds.has(update.update_id)) {
        logger.warn('Duplicate update_id detected - possible replay attack', { 
          updateId: update.update_id 
        })
        return res.json({ ok: true })
      }

      // Add to processed set and clean up if too large
      processedUpdateIds.add(update.update_id)
      if (processedUpdateIds.size > MAX_PROCESSED_IDS) {
        // Remove oldest entries (Set maintains insertion order)
        const iterator = processedUpdateIds.values()
        for (let i = 0; i < 1000; i++) {
          const value = iterator.next().value
          if (value !== undefined) {
            processedUpdateIds.delete(value)
          }
        }
      }

      logger.info('Received Telegram webhook', { updateId: update.update_id })

      // Handle pre-checkout query (must answer within 10 seconds)
      if (update.pre_checkout_query) {
        const { id: queryId, invoice_payload: payload } = update.pre_checkout_query
        
        try {
          const rawPayload = JSON.parse(payload)
          const payloadResult = PayloadSchema.safeParse(rawPayload)
          if (!payloadResult.success) {
            logger.warn('Invalid pre-checkout payload', { errors: payloadResult.error.flatten() })
            const answerUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`
            await fetch(answerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pre_checkout_query_id: queryId, ok: false, error_message: 'Invalid payload' }),
            })
            return res.json({ ok: true })
          }
          const { packageId } = payloadResult.data
          
          if (STARS_PACKAGES[packageId]) {
            // Approve the checkout
            const answerUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`
            await fetch(answerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pre_checkout_query_id: queryId, ok: true }),
            })
            logger.info('Approved pre-checkout query', { queryId, packageId })
          } else {
            // Reject with error
            const answerUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`
            await fetch(answerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                pre_checkout_query_id: queryId, 
                ok: false, 
                error_message: 'Invalid package' 
              }),
            })
            logger.warn('Rejected pre-checkout query - invalid package', { queryId, packageId })
          }
        } catch (error) {
          logger.error('Error processing pre-checkout query', { error, queryId })
          const answerUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`
          await fetch(answerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              pre_checkout_query_id: queryId, 
              ok: false, 
              error_message: 'Processing error' 
            }),
          })
        }
      }

      // Handle successful payment
      if (update.message?.successful_payment) {
        const { successful_payment } = update.message
        const { invoice_payload, telegram_payment_charge_id } = successful_payment
        
        try {
          const rawPayload = JSON.parse(invoice_payload)
          const payloadResult = PayloadSchema.safeParse(rawPayload)
          if (!payloadResult.success) {
            logger.warn('Invalid payment payload', { errors: payloadResult.error.flatten() })
            return res.json({ ok: true })
          }
          const { packageId, telegramId } = payloadResult.data
          
          const pkg = STARS_PACKAGES[packageId]
          if (!pkg) {
            logger.error('Invalid package in payment', { packageId, telegramId })
            return res.json({ ok: true })
          }

          const user = await User.findOne({ telegramId })
          if (!user) {
            logger.error('User not found for payment', { telegramId, packageId })
            return res.json({ ok: true })
          }

          if (pkg.hlx) {
            user.balance += pkg.hlx
            user.portfolioValue += pkg.hlx
            await Position.create({
              userId: user._id,
              type: 'store_purchase',
              amount: pkg.hlx,
              hlxValue: pkg.hlx,
            })
            logger.info(`User ${telegramId} purchased ${pkg.hlx} HLX for ${pkg.starsPrice} stars`, {
              chargeId: telegram_payment_charge_id,
            })
          }

          if (pkg.leverage) {
            user.leverage = pkg.leverage
            await Position.create({
              userId: user._id,
              type: 'store_purchase',
              asset: 'BTC',
              amount: 0,
              hlxValue: 0,
            })
            logger.info(`User ${telegramId} purchased ${pkg.leverage}x leverage for ${pkg.starsPrice} stars`, {
              chargeId: telegram_payment_charge_id,
            })
          }

          await user.save()
          logger.info('Payment processed successfully', { telegramId, packageId, chargeId: telegram_payment_charge_id })
        } catch (error) {
          logger.error('Error processing successful payment', { error, invoice_payload })
        }
      }

      res.json({ ok: true })
    } catch (error) {
      logger.error('Webhook error', { error })
      res.json({ ok: true }) // Always return ok to Telegram
    }
  })

  app.use('/api/auth', authRoutes)
  app.use('/api', allocationRoutes)
  app.use('/api/stars', starsRoutes)
  app.use('/api', leaderboardRoutes)
  app.use('/api/earn', earnRoutes)
  app.use('/api/referral', referralRoutes)

  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error('Unhandled error', { error: err })
    res.status(500).json({ error: 'Internal server error' })
  })

  const io = setupSocketIO(httpServer)

  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`)
      resolve()
    })
  })

  if (env.TELEGRAM_WEBHOOK_URL) {
    const webhookUrl = `${env.TELEGRAM_WEBHOOK_URL}/telegram-webhook`
    const success = await setupTelegramWebhook(webhookUrl, env.TELEGRAM_WEBHOOK_SECRET)
    if (success) {
      const info = await getWebhookInfo()
      logger.info('Telegram webhook info', { info })
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        logger.info('Webhook secret token configured for enhanced security')
      }
    } else {
      logger.warn('Failed to set Telegram webhook - payments may not work', { webhookUrl })
    }
  } else {
    logger.warn('TELEGRAM_WEBHOOK_URL not set - Telegram webhook not configured')
  }

  startTwelveData()
  startLeaderboardCron()

  setInterval(() => {
    broadcastAllPrices()
  }, 30000)

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down')
    httpServer.close(() => process.exit(0))
  })

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down')
    httpServer.close(() => process.exit(0))
  })
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', { error })
  process.exit(1)
})
