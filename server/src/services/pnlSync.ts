import cron from 'node-cron'
import { logger } from '../utils/logger'
import { User } from '../db/models/User'
import { calculatePortfolioValue } from './portfolio'
import { getLatestPrices, broadcastPriceUpdate } from './socket'
import { env } from '../config/env'

const CHUNK_SIZE = 50

const SYMBOL_MAP: Record<string, string> = {
  'BTC/USD': 'BTC',
  'XAU/USD': 'GOLD',
  'EUR/USD': 'EUR',
}

async function fetchPricesFromAPI(): Promise<Record<string, number> | null> {
  try {
    const symbols = Object.keys(SYMBOL_MAP)
    const url = `https://api.twelvedata.com/quote?symbol=${symbols.join(',')}&apikey=${env.TWELVE_DATA_API_KEY}`
    const response = await fetch(url)
    const data = (await response.json()) as Record<string, any>

    const prices: Record<string, number> = {}
    for (const symbol of symbols) {
      const asset = SYMBOL_MAP[symbol]
      const entry = data[symbol]
      if (entry?.price !== undefined) {
        prices[asset] = parseFloat(entry.price)
      }
    }

    if (prices.BTC && prices.GOLD && prices.EUR) {
      // Also seed latestPrices with 24h change data
      for (const symbol of symbols) {
        const entry = data[symbol]
        if (entry?.percent_change !== undefined) {
          broadcastPriceUpdate(symbol, parseFloat(entry.price), Date.now(), parseFloat(entry.percent_change))
        }
      }
      return prices
    }
    return null
  } catch (error) {
    logger.error('Failed to fetch prices from TwelveData REST API', { error })
    return null
  }
}

function pricesAreFresh(cached: ReturnType<typeof getLatestPrices>): boolean {
  const now = Date.now()
  const maxAge = 65 * 60 * 1000
  for (const symbol of Object.keys(SYMBOL_MAP)) {
    const entry = cached[symbol]
    if (!entry || !entry.timestamp || now - entry.timestamp > maxAge) {
      return false
    }
  }
  return true
}

async function getCurrentPrices(): Promise<Record<string, number> | null> {
  const cached = getLatestPrices()

  if (pricesAreFresh(cached)) {
    return {
      BTC: cached['BTC/USD'].price,
      GOLD: cached['XAU/USD'].price,
      EUR: cached['EUR/USD'].price,
    }
  }

  logger.info('Cached prices stale or missing, falling back to TwelveData REST API')
  return fetchPricesFromAPI()
}

async function syncAllPnLs(): Promise<void> {
  logger.info('Hourly PnL sync started')

  const prices = await getCurrentPrices()
  if (!prices) {
    logger.warn('Hourly PnL sync skipped: no price data available')
    return
  }

  try {
    const users = await User.find({
      $or: [
        { 'allocations.BTC': { $gt: 0 } },
        { 'allocations.GOLD': { $gt: 0 } },
        { 'allocations.EUR': { $gt: 0 } },
      ],
    })

    if (users.length === 0) {
      logger.debug('Hourly PnL sync: no users with active allocations')
      return
    }

    let updated = 0
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      const chunk = users.slice(i, i + CHUNK_SIZE)
      const results = await Promise.allSettled(
        chunk.map(async (user) => {
          const initialPrices: Record<string, number> = {}
          if (user.initialPrices.BTC) initialPrices.BTC = user.initialPrices.BTC
          if (user.initialPrices.GOLD) initialPrices.GOLD = user.initialPrices.GOLD
          if (user.initialPrices.EUR) initialPrices.EUR = user.initialPrices.EUR

          const portfolio = calculatePortfolioValue(
            user.balance,
            user.allocations,
            initialPrices,
            prices,
            user.leverage,
            user.assetLeverages || undefined,
          )

          if (portfolio.value <= 0) {
            await User.findByIdAndUpdate(user._id, {
              $set: {
                allocations: { BTC: 0, GOLD: 0, EUR: 0 },
                initialPrices: { BTC: null, GOLD: null, EUR: null },
                balance: 0,
                portfolioValue: 0,
                totalPnl: 0,
                totalPnlPercent: 0,
              },
            })
          } else {
            await User.findByIdAndUpdate(user._id, {
              $set: {
                portfolioValue: portfolio.value,
                totalPnl: portfolio.pnl,
                totalPnlPercent: portfolio.pnlPercent,
              },
            })
          }
        }),
      )

      updated += results.filter((r) => r.status === 'fulfilled').length

      if (i + CHUNK_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    logger.info(`Hourly PnL sync completed: ${updated}/${users.length} users updated`)
  } catch (error) {
    logger.error('Hourly PnL sync failed', { error })
  }
}

export function startHourlyPnlSync(): void {
  syncAllPnLs()

  cron.schedule('0 * * * *', () => {
    syncAllPnLs()
  })

  logger.info('Hourly PnL sync scheduled (0 * * * *)')
}
