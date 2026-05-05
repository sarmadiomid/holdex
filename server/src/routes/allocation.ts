import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { allocationLimiter } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { validateAllocations } from '../services/portfolio'
import { recalcAndBroadcastUser, broadcastAllocationUpdate, getLatestPrices } from '../services/socket'
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
      if (prices['WTI/USD']) initialPrices.OIL = prices['WTI/USD'].price

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

export default router
