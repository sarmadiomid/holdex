import { Router } from 'express'
import { User } from '../db/models/User'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { telegramId } = req

    const user = await User.findOne({ telegramId })
      .populate('referredUsers', 'telegramId firstName username photoUrl')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const referralCount = user.referredUsers.length
    const totalEarned = referralCount * 10 // 10 HLX per referral

    res.json({
      referralCount,
      totalEarned,
      referredUsers: user.referredUsers,
    })
  } catch (error) {
    logger.error('Referral stats error', { error })
    res.status(500).json({ error: 'Failed to fetch referral stats' })
  }
})

export default router
