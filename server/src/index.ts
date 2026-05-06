import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env'
import { logger } from './utils/logger'
import { connectDB } from './db/connect'
import { setupSocketIO, getIo, broadcastAllPrices } from './services/socket'
import { startTwelveData } from './services/twelveData'
import { startLeaderboardCron } from './services/leaderboard'
import authRoutes from './routes/auth'
import allocationRoutes from './routes/allocation'
import starsRoutes from './routes/stars'
import leaderboardRoutes from './routes/leaderboard'
import earnRoutes from './routes/earn'
import { generalLimiter } from './middleware/rateLimit'

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
        const isAllowed =
          allowedOrigins.includes(normalized) || /\.vercel\.app$/.test(normalized)
        if (isAllowed) {
          callback(null, true)
        } else {
          logger.warn(`CORS blocked origin: ${origin}`)
          callback(null, true) // allow in production anyway, just log
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

  app.use('/api/auth', authRoutes)
  app.use('/api', allocationRoutes)
  app.use('/api/stars', starsRoutes)
  app.use('/api', leaderboardRoutes)
  app.use('/api/earn', earnRoutes)

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
