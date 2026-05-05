import { Router } from 'express'
import { User } from '../db/models/User'
import { getLeaderboard } from '../services/leaderboard'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

router.get('/leaderboard', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || '500', 10)
    const { telegramId } = req

    const leaderboard = await getLeaderboard(limit)

    const user = await User.findOne({ telegramId }).select(
      'portfolioValue totalPnl totalPnlPercent',
    )

    let userRank = null
    if (user) {
      const higherCount = await User.countDocuments({
        portfolioValue: { $gt: user.portfolioValue },
        weekStart: user.weekStart,
      })
      userRank = higherCount + 1
    }

    res.json({
      ...leaderboard,
      userPosition: user
        ? {
            portfolioValue: user.portfolioValue,
            pnl: user.totalPnl,
            pnlPercent: user.totalPnlPercent,
            rank: userRank,
          }
        : null,
    })
  } catch (error) {
    logger.error('Leaderboard error', { error })
    res.status(500).json({ error: 'Failed to fetch leaderboard' })
  }
})

export default router
