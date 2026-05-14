import WebSocket from 'ws'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import { broadcastPriceUpdate, recalcUserSilent } from './socket'
import { User, IUser } from '../db/models/User'

const SYMBOLS = ['BTC/USD', 'XAU/USD', 'EUR/USD']
const RECONNECT_DELAY_MS = 5000
const HEARTBEAT_INTERVAL_MS = 10000
const PORTFOLIO_SYNC_INTERVAL_MS = 10000
const CHUNK_SIZE = 50

// قیمت‌های اولیه برای broadcast سریع (fallback تا زمانی که TwelveData وصل شود)
const INITIAL_PRICES = {
  'BTC/USD': 67234.50,
  'XAU/USD': 2341.80,
  'EUR/USD': 1.17
}

let ws: WebSocket | null = null
let heartbeatInterval: NodeJS.Timeout | null = null
let portfolioSyncTimer: NodeJS.Timeout | null = null
let isShuttingDown = false
let hasReceivedRealPrices = false

// --- Periodic portfolio sync (leaderboard/DB updates only, no broadcast) ---
async function processUsersInChunks(users: IUser[]) {
  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE)
    await Promise.allSettled(chunk.map(u => recalcUserSilent(u)))
    if (i + CHUNK_SIZE < users.length) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
}

async function syncPortfolios() {
  if (isShuttingDown) return

  try {
    const users = await User.find({
      $or: [
        { 'allocations.BTC': { $gt: 0 } },
        { 'allocations.GOLD': { $gt: 0 } },
        { 'allocations.EUR': { $gt: 0 } },
      ],
    })

    if (users.length > 0) {
      logger.debug(`Portfolio sync: ${users.length} users`)
      await processUsersInChunks(users)
    }
  } catch (error) {
    logger.error('Error syncing portfolios', { error })
  }
}

function connect() {
  if (isShuttingDown) return

  const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${env.TWELVE_DATA_API_KEY}`

  ws = new WebSocket(url)

  ws.on('open', () => {
    logger.info('TwelveData WebSocket connected')

    ws!.send(
      JSON.stringify({
        action: 'subscribe',
        params: { symbols: SYMBOLS.join(',') },
      }),
    )
    logger.info(`Subscribed to: ${SYMBOLS.join(', ')}`)

    // ✅ Broadcast قیمت‌های اولیه بلافاصله بعد از اتصال
    if (!hasReceivedRealPrices) {
      logger.info('Broadcasting initial prices immediately...')
      Object.entries(INITIAL_PRICES).forEach(([symbol, price]) => {
        broadcastPriceUpdate(symbol, price, Date.now(), 0)
      })
    }

    heartbeatInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'heartbeat' }))
      }
    }, HEARTBEAT_INTERVAL_MS)

    portfolioSyncTimer = setInterval(syncPortfolios, PORTFOLIO_SYNC_INTERVAL_MS)
    logger.info(`Portfolio sync started (every ${PORTFOLIO_SYNC_INTERVAL_MS / 1000}s)`)
  })

  ws.on('message', async (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString())

      if (message.event === 'price') {
        const { symbol, price, timestamp, change_percentage } = message

        if (normalizeSymbol(symbol)) {
          // ✅ اولین بار که قیمت واقعی دریافت شد
          if (!hasReceivedRealPrices) {
            hasReceivedRealPrices = true
            logger.info('✅ First real price received from TwelveData - switching from initial prices')
          }
          
          const change24h = change_percentage !== undefined ? parseFloat(change_percentage) : 0
          broadcastPriceUpdate(symbol, parseFloat(price), timestamp || Date.now(), change24h)
        }
      } else if (message.event === 'subscribe-status') {
        const successList = (message.success || []).map((s: any) => typeof s === 'string' ? s : s.symbol || s)
        const failList = (message.fails || []).map((f: any) => typeof f === 'string' ? f : f.symbol || JSON.stringify(f))
        if (successList.length) {
          logger.info(`TwelveData subscribed: ${successList.join(', ')}`)
        }
        if (failList.length) {
          logger.warn(`TwelveData subscription failures: ${failList.join(', ')}`)
        }
      }
    } catch (error) {
      logger.error('Error processing TwelveData message', { error })
    }
  })

  ws.on('error', (error) => {
    logger.error('TwelveData WebSocket error', { error })
  })

  ws.on('close', (code, reason) => {
    logger.warn('TwelveData WebSocket closed', { code, reason: reason.toString() })
    if (heartbeatInterval) clearInterval(heartbeatInterval)
    if (portfolioSyncTimer) clearInterval(portfolioSyncTimer)

    // Reset flag تا در reconnect دوباره قیمت‌های اولیه broadcast شود
    hasReceivedRealPrices = false

    if (!isShuttingDown) {
      logger.info(`Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`)
      setTimeout(connect, RECONNECT_DELAY_MS)
    }
  })
}

function normalizeSymbol(symbol: string): string | null {
  const map: Record<string, string> = {
    'BTC/USD': 'BTC',
    'XAU/USD': 'GOLD',
    'EUR/USD': 'EUR',
  }
  return map[symbol] || null
}

export function startTwelveData() {
  connect()
}

export function stopTwelveData() {
  isShuttingDown = true
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  if (portfolioSyncTimer) clearInterval(portfolioSyncTimer)
  if (ws) {
    ws.close()
    ws = null
  }
}
