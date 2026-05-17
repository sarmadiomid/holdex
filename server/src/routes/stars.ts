import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logger } from '../utils/logger'
import { createStarsInvoiceLink } from '../services/telegram'

const router = Router()

export const MAX_HLX_BALANCE = 1000

export const STARS_PACKAGES: Record<string, { hlx?: number; leverage?: number; starsPrice: number }> = {
  'hlx_50': { hlx: 50, starsPrice: 10 },
  'hlx_100': { hlx: 100, starsPrice: 20 },
  'hlx_250': { hlx: 250, starsPrice: 40 },
  'hlx_500': { hlx: 500, starsPrice: 70 },
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

      // Check balance cap before creating invoice
      if (pkg.hlx) {
        const user = await User.findOne({ telegramId })
        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }
        if (user.balance + pkg.hlx > MAX_HLX_BALANCE) {
          return res.status(400).json({
            error: `Cannot purchase. This package would exceed your maximum allowed balance of ${MAX_HLX_BALANCE.toLocaleString()} HLX.`,
          })
        }
      }

      // Create human-readable title and description
      const title = pkg.hlx
        ? `${pkg.hlx.toLocaleString()} HLX Tokens`
        : `${pkg.leverage}x Leverage Booster`
      
      const description = pkg.hlx
        ? `Purchase ${pkg.hlx.toLocaleString()} HLX tokens for Zollar trading`
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
