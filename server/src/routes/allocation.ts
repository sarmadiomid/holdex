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
  OIL: z.number().min(0).max(100).default(0),
})

router.post(
  '/allocation',
  authMiddleware,
  allocationLimiter,
  validate(allocationSchema),
  async (req: AuthRequest, res) => {
    try {
      const { telegramId } = req
      const allocations = req.body as { BTC: number; GOLD: number; OIL: number }

      const validation = validateAllocations(allocations)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }

      const user = await User.findOne({ telegramId })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      const prices = getLatestPrices()
      const initialPrices: Record<string, number | null> = { BTC: null, GOLD: null, OIL: null }

      if (prices['BTC/USD']) initialPrices.BTC = prices['BTC/USD'].price
      if (prices['XAU/USD']) initialPrices.GOLD = prices['XAU/USD'].price
      if (prices['USOIL']) initialPrices.OIL = prices['USOIL'].price

      user.allocations = allocations
      user.initialPrices = {
        BTC: initialPrices.BTC,
        GOLD: initialPrices.GOLD,
        OIL: initialPrices.OIL,
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

    const totalAllocated = user.allocations.BTC + user.allocations.GOLD + user.allocations.OIL
    if (totalAllocated === 0) {
      return res.status(400).json({ error: 'No holdings to sell' })
    }

    const prices = getLatestPrices()
    await recalcAndBroadcastUser(user)

    const pnl = user.totalPnl
    const newBalance = Math.round((user.balance + pnl) * 100) / 100

    const soldPositions: { asset: string; allocation: number; pnl: number }[] = []

    for (const asset of ['BTC', 'GOLD', 'OIL'] as const) {
      const alloc = user.allocations[asset]
      if (alloc > 0) {
        const allocatedAmount = user.balance * (alloc / 100)
        const initialPrice = user.initialPrices[asset]
        const twelveSymbol = asset === 'BTC' ? 'BTC/USD' : asset === 'GOLD' ? 'XAU/USD' : 'USOIL'
        const currentPrice = prices[twelveSymbol]?.price ?? initialPrice ?? 0

        let assetPnl = 0
        if (initialPrice && currentPrice && initialPrice > 0) {
          const priceChange = (currentPrice - initialPrice) / initialPrice
          const multiplier = asset === 'BTC' ? 100 : asset === 'GOLD' ? 50 : 80
          assetPnl = allocatedAmount * priceChange * multiplier * user.leverage
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

    user.allocations = { BTC: 0, GOLD: 0, OIL: 0 }
    user.initialPrices = { BTC: null, GOLD: null, OIL: null }
    user.balance = newBalance
    user.portfolioValue = newBalance
    user.totalPnl = 0
    user.totalPnlPercent = 0

    await user.save()

    broadcastAllocationUpdate(user.telegramId, { BTC: 0, GOLD: 0, OIL: 0 })
    broadcastUserUpdate(user.telegramId, {
      portfolioValue: newBalance,
      totalPnl: 0,
      totalPnlPercent: 0,
    })

    logger.info(`All holdings sold for user ${telegramId}, new balance: ${newBalance}`)

    res.json({
      success: true,
      newBalance,
      pnl: Math.round(pnl * 100) / 100,
      soldPositions,
    })
  } catch (error) {
    logger.error('Sell all error', { error })
    res.status(500).json({ error: 'Failed to sell holdings' })
  }
})

export default router
