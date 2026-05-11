import { Router } from 'express'
import * as jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { User } from '../db/models/User'
import { validateTelegramInitData, parseTelegramUser, parseStartParam } from '../services/auth'
import { processReferral } from '../services/referral'
import { authLimiter } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { z } from 'zod'
import { logger } from '../utils/logger'

const router = Router()

const authSchema = z.object({
  initData: z.string(),
})

router.post(
  '/',
  authLimiter,
  validate(authSchema, 'body'),
  async (req, res) => {
    try {
      const { initData } = req.body as { initData: string }

      const { valid, data } = validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN)

      if (!valid || !data) {
        return res.status(401).json({ error: 'Invalid Telegram authentication' })
      }

      const telegramUser = parseTelegramUser(data)
      if (!telegramUser) {
        return res.status(400).json({ error: 'Invalid user data' })
      }

      const referrerTelegramId = parseStartParam(initData)
      let referrerId: number | null = null
      if (referrerTelegramId) {
        referrerId = parseInt(referrerTelegramId, 10)
        if (isNaN(referrerId)) referrerId = null
        logger.info(`Referral detected: ${referrerId}`)
      } else {
        logger.info('No referral parameter found in initData')
      }

      let user = await User.findOne({ telegramId: telegramUser.id })

      const isNewUser = !user

      if (!user) {
        user = await User.create({
          telegramId: telegramUser.id,
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          photoUrl: telegramUser.photo_url,
          balance: 100,
          allocations: { BTC: 0, GOLD: 0, EUR: 0 },
          initialPrices: { BTC: null, GOLD: null, EUR: null },
          leverage: 1,
          portfolioValue: 100,
          totalPnl: 0,
          totalPnlPercent: 0,
          referredUsers: [],
        })

        logger.info(`New user registered: ${telegramUser.id} (${telegramUser.first_name})`)
      } else {
        user.username = telegramUser.username || user.username
        user.firstName = telegramUser.first_name || user.firstName
        user.lastName = telegramUser.last_name || user.lastName
        user.photoUrl = telegramUser.photo_url || user.photoUrl
        await user.save()
      }

      // Process referral only for new users
      if (isNewUser && referrerId) {
        const { inviteTaskCompleted, newBalance } = await processReferral(user, referrerId)
        // Reload user to get updated balance if they were referred
        const reloadedUser = await User.findById(user._id)
        if (reloadedUser) {
          user = reloadedUser
        }
      }

      const token = jwt.sign(
        { userId: user._id.toString(), telegramId: user.telegramId },
        env.JWT_SECRET,
        { expiresIn: '30d' },
      )

      res.json({
        token,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
          balance: user.balance,
          allocations: user.allocations,
          initialPrices: user.initialPrices,
          leverage: user.leverage,
          assetLeverages: user.assetLeverages || { BTC: 1, GOLD: 1, EUR: 1 },
          portfolioValue: user.portfolioValue,
          totalPnl: user.totalPnl,
          totalPnlPercent: user.totalPnlPercent,
          completedTasks: user.completedTasks || [],
        },
      })
    } catch (error) {
      logger.error('Auth error', { error })
      res.status(500).json({ error: 'Authentication failed' })
    }
  },
)

export default router
