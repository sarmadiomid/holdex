import WebSocket from 'ws'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import { broadcastPriceUpdate, recalcAndBroadcastUser } from './socket'
import { User } from '../db/models/User'

const SYMBOLS = ['BTC/USD', 'XAU/USD', 'WTI/USD']
const RECONNECT_DELAY_MS = 5000
const HEARTBEAT_INTERVAL_MS = 10000

let ws: WebSocket | null = null
let heartbeatInterval: NodeJS.Timeout | null = null
let isShuttingDown = false

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

    heartbeatInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'heartbeat' }))
      }
    }, HEARTBEAT_INTERVAL_MS)
  })

  ws.on('message', async (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString())

      if (message.event === 'price') {
        const { symbol, price, timestamp } = message
        const normalizedSymbol = normalizeSymbol(symbol)

        if (normalizedSymbol) {
          broadcastPriceUpdate(symbol, parseFloat(price), timestamp || Date.now())

          const users = await User.find({
            [`allocations.${normalizedSymbol}`]: { $gt: 0 },
          })

          for (const user of users) {
            await recalcAndBroadcastUser(user)
          }
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
    'WTI/USD': 'OIL',
  }
  return map[symbol] || null
}

export function startTwelveData() {
  connect()
}

export function stopTwelveData() {
  isShuttingDown = true
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  if (ws) {
    ws.close()
    ws = null
  }
}
