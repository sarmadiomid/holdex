import WebSocket from 'ws'
import { env } from '../config/env'
import { logger } from '../utils/logger'
import { broadcastPriceUpdate, recalcAndBroadcastUser } from './socket'
import { User, IUser } from '../db/models/User'

const SYMBOLS = ['BTC/USD', 'XAU/USD', 'EUR/USD']
const RECONNECT_DELAY_MS = 5000
const HEARTBEAT_INTERVAL_MS = 10000
const BATCH_WINDOW_MS = 500
const CHUNK_SIZE = 50

let ws: WebSocket | null = null
let heartbeatInterval: NodeJS.Timeout | null = null
let isShuttingDown = false

// --- Batch processing system ---
let pendingSymbols = new Set<string>()
let batchTimer: NodeJS.Timeout | null = null
let isProcessingBatch = false

function scheduleBatch() {
  if (batchTimer) clearTimeout(batchTimer)
  if (!isProcessingBatch) {
    batchTimer = setTimeout(processBatch, BATCH_WINDOW_MS)
  }
}

async function processUsersInChunks(users: IUser[]) {
  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE)
    await Promise.allSettled(chunk.map(u => recalcAndBroadcastUser(u)))
    if (i + CHUNK_SIZE < users.length) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }
}

async function processBatch() {
  if (isProcessingBatch) return
  isProcessingBatch = true
  batchTimer = null

  const symbolsToProcess = Array.from(pendingSymbols)
  pendingSymbols.clear()

  for (const symbol of symbolsToProcess) {
    try {
      const users = await User.find({
        [`allocations.${symbol}`]: { $gt: 0 },
      })

      logger.debug(`Batch processing ${symbol}: ${users.length} users`)

      await processUsersInChunks(users)
    } catch (error) {
      logger.error(`Error processing batch for ${symbol}`, { error })
    }
  }

  isProcessingBatch = false

  if (pendingSymbols.size > 0) {
    scheduleBatch()
  }
}

function processPriceUpdate(normalizedSymbol: string, rawSymbol: string, price: number, timestamp: number) {
  broadcastPriceUpdate(rawSymbol, price, timestamp)

  pendingSymbols.add(normalizedSymbol)
  scheduleBatch()
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
          processPriceUpdate(normalizedSymbol, symbol, parseFloat(price), timestamp || Date.now())
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
  if (ws) {
    ws.close()
    ws = null
  }
}
