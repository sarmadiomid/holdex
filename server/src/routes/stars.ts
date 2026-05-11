import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logger } from '../utils/logger'
import { createStarsInvoiceLink } from '../services/telegram'

const router = Router()

export const STARS_PACKAGES: Record<string, { hlx?: number; leverage?: number; starsPrice: number }> = {
  'hlx_1000': { hlx: 1000, starsPrice: 50 },
  'hlx_5000': { hlx: 5000, starsPrice: 200 },
  'hlx_10000': { hlx: 10000, starsPrice: 350 },
  'hlx_50000': { hlx: 50000, starsPrice: 1500 },
  'lev_2x': { leverage: 2, starsPrice: 250 },
  'lev_5x': { leverage: 5, starsPrice: 1 },
  'lev_10x': { leverage: 10, starsPrice: 1000 },
}

const purchaseSchema = z.object({
  packageId: z.string(),
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

      // Create human-readable title and description
      const title = pkg.hlx
        ? `${pkg.hlx.toLocaleString()} HLX Tokens`
        : `${pkg.leverage}x Leverage Booster`
      
      const description = pkg.hlx
        ? `Purchase ${pkg.hlx.toLocaleString()} HLX tokens for Holdex trading`
        : `Unlock ${pkg.leverage}x leverage for your trades`

      // Create real Telegram Stars invoice link
      const invoiceLink = await createStarsInvoiceLink({
        title,
        description,
        payload: JSON.stringify({ packageId, telegramId }),
        amount: pkg.starsPrice,
      })

      if (!invoiceLink) {
        return res.status(500).json({ error: 'Failed to create invoice' })
      }

      logger.info(`Created Stars invoice for user ${telegramId}, package ${packageId}`)

      res.json({
        invoiceUrl: invoiceLink,
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

// Note: This webhook endpoint is deprecated and unused.
// Telegram Stars payments are handled via /telegram-webhook in server/src/index.ts
// which receives webhooks directly from Telegram's servers.
// This endpoint is kept for backwards compatibility but should not be used.

export default router
