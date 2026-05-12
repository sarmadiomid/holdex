import { Server as HTTPServer } from 'http'
import { Server, Socket } from 'socket.io'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import { User, IUser } from '../db/models/User'
import { calculatePortfolioValue } from '../services/portfolio'
import * as jwt from 'jsonwebtoken'
import { socketRateLimitMiddleware } from '../middleware/socketRateLimit'

interface MarketPrice {
  symbol: string
  price: number
  timestamp: number
}

interface SocketData {
  userId: string
  telegramId: number
}

type AuthSocket = Socket & SocketData

let latestPrices: Record<string, MarketPrice> = {}
let ioInstance: Server | null = null

export function setupSocketIO(httpServer: HTTPServer): Server {
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

  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        const normalized = normalizeOrigin(origin)
        if (allowedOrigins.includes(normalized)) {
          return callback(null, true)
        }
        callback(new Error('Not allowed by CORS'), false)
      },
      credentials: true,
    },
  })

  // Layer 1: Rate Limiting (قبل از authentication)
  ioInstance.use(socketRateLimitMiddleware)

  // Layer 2: Authentication (بعد از rate limiting)
  ioInstance.use(async (socket, next) => {
    try {
      const s = socket as AuthSocket
      const token = socket.handshake.auth.token

      if (!token) {
        logger.warn(
          `Socket connection rejected: No token provided from IP ${socket.handshake.address}`,
        )
        return next(new Error('Authentication required'))
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        userId: string
        telegramId: number
      }

      s.userId = decoded.userId
      s.telegramId = decoded.telegramId

      logger.info(
        `Socket authenticated successfully for user: ${s.telegramId} (${s.userId})`,
      )
      next()
    } catch (error) {
      logger.warn(
        `Socket authentication failed from IP ${socket.handshake.address}:`,
        error,
      )
      next(new Error('Invalid or expired token'))
    }
  })

  ioInstance.on('connection', (socket) => {
    const s = socket as AuthSocket
    logger.info(
      `Socket connected: User ${s.telegramId} (${s.userId}) from IP ${socket.handshake.address}`,
    )
    s.join(s.telegramId.toString())

    // ✅ بلافاصله بعد از اتصال، قیمت‌های فعلی را برای کاربر ارسال کن
    if (Object.keys(latestPrices).length > 0) {
      socket.emit('prices_snapshot', latestPrices)
      logger.debug(`Sent price snapshot to user ${s.telegramId}`)
    }

    socket.on('disconnect', (reason) => {
      logger.info(
        `Socket disconnected: User ${s.telegramId} - Reason: ${reason}`,
      )
    })
  })

  return ioInstance
}

export function broadcastPriceUpdate(
  symbol: string,
  price: number,
  timestamp: number,
) {
  latestPrices[symbol] = { symbol, price, timestamp }
  if (ioInstance) {
    ioInstance.emit('price_update', { symbol, price, timestamp })
  }
}

export function broadcastUserUpdate(
  telegramId: number,
  userData: Partial<IUser>,
) {
  if (!ioInstance) return
  ioInstance.to(telegramId.toString()).emit('user_update', userData)
}

export function broadcastAllocationUpdate(
  telegramId: number,
  allocations: { BTC: number; GOLD: number; EUR: number },
) {
  if (!ioInstance) return
  ioInstance.emit('allocation_update', { telegramId, allocations })
}

export function broadcastAllPrices() {
  if (!ioInstance) return
  ioInstance.emit('prices_snapshot', latestPrices)
}

export async function recalcUserSilent(user: IUser) {
  const prices = latestPrices
  if (!prices['BTC/USD'] || !prices['XAU/USD'] || !prices['EUR/USD']) {
    return user
  }

  const currentPrices: Record<string, number> = {
    BTC: prices['BTC/USD'].price,
    GOLD: prices['XAU/USD'].price,
    EUR: prices['EUR/USD'].price,
  }

  const initialPrices: Record<string, number> = {}
  if (user.initialPrices.BTC) initialPrices.BTC = user.initialPrices.BTC
  if (user.initialPrices.GOLD) initialPrices.GOLD = user.initialPrices.GOLD
  if (user.initialPrices.EUR) initialPrices.EUR = user.initialPrices.EUR

  const portfolio = calculatePortfolioValue(
    user.balance,
    user.allocations,
    initialPrices,
    currentPrices,
    user.leverage,
    user.assetLeverages || undefined,
  )

  // Reset if portfolio hits 0 — this MUST broadcast to sync the client
  if (portfolio.value <= 0) {
    user.allocations = { BTC: 0, GOLD: 0, EUR: 0 }
    user.initialPrices = { BTC: null, GOLD: null, EUR: null }
    user.balance = 0
    user.portfolioValue = 0
    user.totalPnl = 0
    user.totalPnlPercent = 0
    await user.save()

    broadcastAllocationUpdate(user.telegramId, { BTC: 0, GOLD: 0, EUR: 0 })
    broadcastUserUpdate(user.telegramId, {
      portfolioValue: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
    })
    return user
  }

  // Silent DB update — no broadcast to avoid race with client display
  await User.findByIdAndUpdate(user._id, {
    portfolioValue: portfolio.value,
    totalPnl: portfolio.pnl,
    totalPnlPercent: portfolio.pnlPercent,
  })

  return user
}

export async function recalcAndBroadcastUser(user: IUser) {
  const prices = latestPrices
  if (!prices['BTC/USD'] || !prices['XAU/USD'] || !prices['EUR/USD']) {
    return user
  }

  const currentPrices: Record<string, number> = {
    BTC: prices['BTC/USD'].price,
    GOLD: prices['XAU/USD'].price,
    EUR: prices['EUR/USD'].price,
  }

  const initialPrices: Record<string, number> = {}
  if (user.initialPrices.BTC) initialPrices.BTC = user.initialPrices.BTC
  if (user.initialPrices.GOLD) initialPrices.GOLD = user.initialPrices.GOLD
  if (user.initialPrices.EUR) initialPrices.EUR = user.initialPrices.EUR

  const portfolio = calculatePortfolioValue(
    user.balance,
    user.allocations,
    initialPrices,
    currentPrices,
    user.leverage,
    user.assetLeverages || undefined,
  )

  // Reset all positions if portfolio value hits 0 or below
  if (portfolio.value <= 0) {
    user.allocations = { BTC: 0, GOLD: 0, EUR: 0 }
    user.initialPrices = { BTC: null, GOLD: null, EUR: null }
    user.balance = 0
    user.portfolioValue = 0
    user.totalPnl = 0
    user.totalPnlPercent = 0
    await user.save()

    broadcastAllocationUpdate(user.telegramId, { BTC: 0, GOLD: 0, EUR: 0 })
    broadcastUserUpdate(user.telegramId, {
      portfolioValue: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
    })
    return user
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    {
      portfolioValue: portfolio.value,
      totalPnl: portfolio.pnl,
      totalPnlPercent: portfolio.pnlPercent,
    },
    { new: true },
  )

  if (updated) {
    broadcastUserUpdate(updated.telegramId, {
      portfolioValue: updated.portfolioValue,
      totalPnl: updated.totalPnl,
      totalPnlPercent: updated.totalPnlPercent,
    })
  }

  return updated || user
}

export function getLatestPrices() {
  return latestPrices
}

export function getIo() {
  return ioInstance
}
