import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { allocationLimiter } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { validateAllocations } from '../services/portfolio'
import { recalcAndBroadcastUser, broadcastAllocationUpdate, broadcastUserUpdate, getLatestPrices } from '../services/socket'
import { getTournamentPhase } from '../services/leaderboard'
import { logger } from '../utils/logger'

const router = Router()

const allocationSchema = z.object({
  BTC: z.number().min(0).max(100).default(0),
  GOLD: z.number().min(0).max(100).default(0),
  EUR: z.number().min(0).max(100).default(0),
})

const assetLeverageSchema = z.object({
  asset: z.enum(['BTC', 'GOLD', 'EUR']),
  leverage: z.number().min(1).max(10),
})

router.post(
  '/allocation',
  authMiddleware,
  allocationLimiter,
  validate(allocationSchema),
  async (req: AuthRequest, res) => {
    try {
      const { telegramId } = req
      const allocations = req.body as { BTC: number; GOLD: number; EUR: number }

      const phase = getTournamentPhase()
      if (phase === 'cooldown') {
        return res.status(403).json({ error: 'Tournament is currently in cooldown phase. Allocations are disabled until the next tournament starts.' })
      }

      const validation = validateAllocations(allocations)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }

      const user = await User.findOne({ telegramId })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const prices = getLatestPrices()
      const initialPrices: Record<string, number | null> = { BTC: null, GOLD: null, EUR: null }

      if (prices['BTC/USD']) initialPrices.BTC = prices['BTC/USD'].price
      if (prices['XAU/USD']) initialPrices.GOLD = prices['XAU/USD'].price
      if (prices['EUR/USD']) initialPrices.EUR = prices['EUR/USD'].price

      // Use transaction to ensure atomicity of user update + position creation
      const session = await user.db.startSession()
      try {
        await session.withTransaction(async () => {
          user.allocations = allocations
          user.initialPrices = {
            BTC: initialPrices.BTC,
            GOLD: initialPrices.GOLD,
            EUR: initialPrices.EUR,
          }

          await user.save({ session })

          const multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }
          for (const asset of ['BTC', 'GOLD', 'EUR'] as const) {
            const alloc = allocations[asset]
            if (alloc > 0) {
              const allocatedAmount = (user.balance * alloc) / 100
              await Position.create([{
                userId: user._id,
                type: 'allocate',
                asset,
                amount: alloc,
                hlxValue: allocatedAmount,
                priceAtTime: initialPrices[asset] ?? undefined,
              }], { session })
            }
          }
        })
      } finally {
        await session.endSession()
      }

      const updated = await recalcAndBroadcastUser(user)
      broadcastAllocationUpdate(user.telegramId, allocations)
      
      // Send initialPrices immediately to prevent race condition with price_update
      broadcastUserUpdate(user.telegramId, {
        initialPrices: updated.initialPrices,
      })

      logger.info(`Allocation set for user ${telegramId}: ${JSON.stringify(allocations)}`)

      res.json({
        allocations: updated.allocations,
        initialPrices: updated.initialPrices,
        portfolioValue: updated.portfolioValue,
        totalPnl: updated.totalPnl,
        totalPnlPercent: updated.totalPnlPercent,
      })
    } catch (error) {
      logger.error('Allocation error', { error })
      res.status(500).json({ error: 'Failed to set allocation' })
    }
  },
)

router.get('/allocation', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { telegramId } = req
    const user = await User.findOne({ telegramId }).select('allocations initialPrices')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({
      allocations: user.allocations,
      initialPrices: user.initialPrices,
    })
  } catch (error) {
    logger.error('Get allocation error', { error })
    res.status(500).json({ error: 'Failed to get allocation' })
  }
})

router.post('/allocation/sell', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { telegramId } = req

    const phase = getTournamentPhase()
    if (phase === 'cooldown') {
      return res.status(403).json({ error: 'Tournament is currently in cooldown phase. Selling is disabled until the next tournament starts.' })
    }

    const user = await User.findOne({ telegramId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const totalAllocated = user.allocations.BTC + user.allocations.GOLD + user.allocations.EUR
    if (totalAllocated === 0) {
      return res.status(400).json({ error: 'No holdings to sell' })
    }

    const prices = getLatestPrices()
    const multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }
    const assetLeverages = user.assetLeverages || { BTC: user.leverage, GOLD: user.leverage, EUR: user.leverage }
    let totalValue = 0
    const soldPositions: { asset: string; allocation: number; pnl: number }[] = []

    for (const asset of ['BTC', 'GOLD', 'EUR'] as const) {
      const alloc = user.allocations[asset]
      if (alloc > 0) {
        const allocatedAmount = user.balance * (alloc / 100)
        const initialPrice = user.initialPrices[asset]
        const twelveSymbol = asset === 'BTC' ? 'BTC/USD' : asset === 'GOLD' ? 'XAU/USD' : 'EUR/USD'
        const currentPrice = prices[twelveSymbol]?.price ?? initialPrice ?? 0

        let assetPnl = 0
        if (initialPrice && currentPrice && initialPrice > 0) {
          const priceChange = (currentPrice - initialPrice) / initialPrice
          const multiplier = multipliers[asset]
          const assetLeverage = assetLeverages[asset] || user.leverage
          const leveragedChange = priceChange * multiplier * assetLeverage
          assetPnl = allocatedAmount * leveragedChange
          totalValue += allocatedAmount * (1 + leveragedChange)
        } else {
          totalValue += allocatedAmount
        }

        soldPositions.push({ asset, allocation: alloc, pnl: assetPnl })
      }
    }

    const unallocatedPercent = 100 - totalAllocated
    totalValue += user.balance * (unallocatedPercent / 100)

    let newBalance = Math.max(0, Math.round(totalValue * 100) / 100)
    const pnl = Math.round((totalValue - user.balance) * 100) / 100

    // Create sell position records (no transaction needed — sequential atomic ops)
    const sellPositionDocs = soldPositions.map(({ asset, allocation, pnl: assetPnl }) => {
      const allocatedAmount = user.balance * (allocation / 100)
      const twelveSymbol = asset === 'BTC' ? 'BTC/USD' : asset === 'GOLD' ? 'XAU/USD' : 'EUR/USD'
      const currentPrice = prices[twelveSymbol]?.price ?? user.initialPrices[asset as 'BTC' | 'GOLD' | 'EUR'] ?? 0
      
      return {
        userId: user._id,
        type: 'sell' as const,
        asset,
        amount: allocation,
        hlxValue: Math.round((allocatedAmount + assetPnl) * 100) / 100,
        pnl: Math.round(assetPnl * 100) / 100,
        priceAtTime: currentPrice,
      }
    })

    if (sellPositionDocs.length > 0) {
      await Position.create(sellPositionDocs)
    }

    // Atomically reset user — use findOneAndUpdate to avoid any version/document conflicts
    await User.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          allocations: { BTC: 0, GOLD: 0, EUR: 0 },
          initialPrices: { BTC: null, GOLD: null, EUR: null },
          balance: Math.max(0, newBalance),
          portfolioValue: Math.max(0, newBalance),
          totalPnl: 0,
          totalPnlPercent: 0,
        },
      },
    )

    broadcastAllocationUpdate(user.telegramId, { BTC: 0, GOLD: 0, EUR: 0 })
    broadcastUserUpdate(user.telegramId, {
      portfolioValue: newBalance,
      totalPnl: 0,
      totalPnlPercent: 0,
    })

    logger.info(`All holdings sold for user ${telegramId}, new balance: ${newBalance}`)

    res.json({
      success: true,
      newBalance,
      pnl,
      soldPositions,
    })
  } catch (error) {
    logger.error('Sell all error', { error })
    res.status(500).json({ error: 'Failed to sell holdings' })
  }
})

router.post(
  '/asset-leverage',
  authMiddleware,
  validate(assetLeverageSchema),
  async (req: AuthRequest, res) => {
    try {
      const { telegramId } = req
      const { asset, leverage } = req.body as { asset: 'BTC' | 'GOLD' | 'EUR'; leverage: number }

      const user = await User.findOne({ telegramId })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      if (!user.assetLeverages) {
        user.assetLeverages = { BTC: 1, GOLD: 1, EUR: 1 }
      }

      user.assetLeverages[asset] = leverage
      await user.save()

      broadcastUserUpdate(user.telegramId, {
        assetLeverages: user.assetLeverages,
      })

      logger.info(`Asset leverage updated for user ${telegramId}: ${asset} = ${leverage}x`)

      res.json({
        success: true,
        assetLeverages: user.assetLeverages,
      })
    } catch (error) {
      logger.error('Asset leverage error', { error })
      res.status(500).json({ error: 'Failed to update asset leverage' })
    }
  },
)

router.get(
  '/position-history',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { telegramId } = req
      logger.info('Position history requested', { telegramId })

      const user = await User.findOne({ telegramId })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      logger.info('Found user for position history', { userId: user._id })

      const positions = await Position.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()

      logger.info('Found positions', { count: positions.length })

      if (positions.length === 0) {
        return res.json({ history: [] })
      }

      // Calculate PnL for each entry - show actual HLX profit/loss
      const history = positions.map((p, idx) => {
        const entry: any = {
          id: p._id.toString(),
          type: p.type,
          asset: p.asset,
          amount: p.amount,
          hlxValue: p.hlxValue,
          priceAtTime: p.priceAtTime,
          createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        }
        
        // For sell entries, calculate pnl from hlxValue difference
        if (p.type === 'sell') {
          if (p.pnl !== undefined) {
            entry.pnl = p.pnl
          } else {
            // For old records without pnl, find corresponding allocate to get original allocation
            let originalAlloc = 0
            // Look ahead in the array (older entries)
            for (let i = idx + 1; i < positions.length; i++) {
              if (positions[i].type === 'allocate' && positions[i].asset === p.asset) {
                originalAlloc = positions[i].hlxValue
                break
              }
            }
            // pnl = received - original allocation
            entry.pnl = p.hlxValue - originalAlloc
          }
        }
        
        return entry
      })

      res.json({ history })
    } catch (error) {
      logger.error('Position history error', { error })
      res.status(500).json({ error: 'Failed to get position history' })
    }
  },
)

export default router
