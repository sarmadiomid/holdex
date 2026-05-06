import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { allocationLimiter } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { validateAllocations } from '../services/portfolio'
import { recalcAndBroadcastUser, broadcastAllocationUpdate, broadcastUserUpdate, getLatestPrices } from '../services/socket'
import { logger } from '../utils/logger'

const router = Router()

const allocationSchema = z.object({
  BTC: z.number().min(0).max(100).default(0),
  GOLD: z.number().min(0).max(100).default(0),
  EUR: z.number().min(0).max(100).default(0),
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

      user.allocations = allocations
      user.initialPrices = {
        BTC: initialPrices.BTC,
        GOLD: initialPrices.GOLD,
        EUR: initialPrices.EUR,
      }

      await user.save()

      await Position.create({
        userId: user._id,
        type: 'allocate',
        amount: validation.total || 0,
        hlxValue: (validation.total || 0) * user.balance / 100,
      })

      const updated = await recalcAndBroadcastUser(user)
      broadcastAllocationUpdate(user.telegramId, allocations)

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
          const leveragedChange = priceChange * multiplier * user.leverage
          assetPnl = allocatedAmount * leveragedChange
          totalValue += allocatedAmount * (1 + leveragedChange)
        } else {
          totalValue += allocatedAmount
        }

        soldPositions.push({ asset, allocation: alloc, pnl: assetPnl })

        await Position.create({
          userId: user._id,
          type: 'sell',
          asset,
          amount: alloc,
          hlxValue: allocatedAmount + assetPnl,
          priceAtTime: currentPrice,
        })
      }
    }

    const unallocatedPercent = 100 - totalAllocated
    totalValue += user.balance * (unallocatedPercent / 100)

    const newBalance = Math.round(totalValue * 100) / 100
    const pnl = Math.round((totalValue - user.balance) * 100) / 100

    user.allocations = { BTC: 0, GOLD: 0, EUR: 0 }
    user.initialPrices = { BTC: null, GOLD: null, EUR: null }
    user.balance = newBalance
    user.portfolioValue = newBalance
    user.totalPnl = 0
    user.totalPnlPercent = 0

    await user.save()

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
      pnl: Math.round((newBalance - user.balance) * 100) / 100,
      soldPositions,
    })
  } catch (error) {
    logger.error('Sell all error', { error })
    res.status(500).json({ error: 'Failed to sell holdings' })
  }
})

export default router
