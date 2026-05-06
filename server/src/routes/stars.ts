import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logger } from '../utils/logger'

const router = Router()

const purchaseSchema = z.object({
  packageId: z.string(),
})

const STARS_PACKAGES: Record<string, { hlx?: number; leverage?: number; starsPrice: number }> = {
  'hlx_1000': { hlx: 1000, starsPrice: 50 },
  'hlx_5000': { hlx: 5000, starsPrice: 200 },
  'hlx_10000': { hlx: 10000, starsPrice: 350 },
  'hlx_50000': { hlx: 50000, starsPrice: 1500 },
  'lev_2x': { leverage: 2, starsPrice: 250 },
  'lev_5x': { leverage: 5, starsPrice: 500 },
  'lev_10x': { leverage: 10, starsPrice: 1000 },
}

const webhookSchema = z.object({
  telegramId: z.number(),
  packageId: z.string(),
  status: z.enum(['paid', 'cancelled', 'failed', 'pending']),
})

router.post(
  '/purchase',
  authMiddleware,
  validate(purchaseSchema),
  async (req: AuthRequest, res) => {
    try {
      const { telegramId } = req
      const { packageId } = req.body as { packageId: string }

      const pkg = STARS_PACKAGES[packageId]
      if (!pkg) {
        return res.status(400).json({ error: 'Invalid package' })
      }

      const invoiceUrl = `https://t.me/holdextest_bot?start=pay_${packageId}_${telegramId}`

      res.json({
        invoiceUrl,
        package: {
          id: packageId,
          starsPrice: pkg.starsPrice,
          hlx: pkg.hlx,
          leverage: pkg.leverage,
        },
      })
    } catch (error) {
      logger.error('Purchase error', { error })
      res.status(500).json({ error: 'Purchase failed' })
    }
  },
)

router.post(
  '/webhook',
  validate(webhookSchema),
  async (req, res) => {
    try {
      const { telegramId, packageId, status } = req.body as {
        telegramId: number
        packageId: string
        status: string
      }

      if (status !== 'paid') {
        return res.json({ received: true })
      }

      const pkg = STARS_PACKAGES[packageId]
      if (!pkg) {
        return res.status(400).json({ error: 'Invalid package' })
      }

      const user = await User.findOne({ telegramId })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
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

        logger.info(`User ${telegramId} purchased ${pkg.hlx} HLX for ${pkg.starsPrice} stars`)
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

        logger.info(`User ${telegramId} purchased ${pkg.leverage}x leverage for ${pkg.starsPrice} stars`)
      }

      await user.save()

      res.json({ success: true })
    } catch (error) {
      logger.error('Stars webhook error', { error })
      res.status(500).json({ error: 'Webhook processing failed' })
    }
  },
)

export default router
