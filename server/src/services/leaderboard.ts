import cron from 'node-cron'
import { User } from '../db/models/User'
import { LeaderboardEntry } from '../db/models/Leaderboard'
import { logger } from '../utils/logger'
import mongoose from 'mongoose'

const PRIZE_POOL_TON = 500
const DISTRIBUTION = [
  { rank: 1, percentage: 40, tonAmount: 200 },
  { rank: 2, percentage: 25, tonAmount: 125 },
  { rank: 3, percentage: 15, tonAmount: 75 },
  { rank: 4, percentage: 10, tonAmount: 50 },
  { rank: 5, percentage: 5, tonAmount: 25 },
  { rank: 6, percentage: 3, tonAmount: 15 },
  { rank: 7, percentage: 2, tonAmount: 10 },
]

function getCurrentSeason(): number {
  const epoch = new Date('2025-01-06T00:00:00Z').getTime()
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  return Math.floor((now - epoch) / weekMs) + 1
}

function getWeekBoundaries(): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const start = new Date(now)
  start.setUTCDate(now.getUTCDate() - dayOfWeek)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  return { start, end }
}

export async function calculateAndSaveLeaderboard(): Promise<void> {
  const season = getCurrentSeason()
  const { start, end } = getWeekBoundaries()

  logger.info(`Calculating leaderboard for season ${season}`)

  const users = await User.find({ weekStart: { $gte: start } })
    .sort({ totalPnlPercent: -1 })
    .limit(100)

  const entries = []

  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const prize = DISTRIBUTION.find((d) => d.rank === i + 1)

    entries.push({
      userId: user._id,
      telegramId: user.telegramId,
      username: user.username || `user${user.telegramId}`,
      firstName: user.firstName,
      photoUrl: user.photoUrl,
      portfolioValue: user.portfolioValue,
      pnl: user.totalPnl,
      pnlPercent: user.totalPnlPercent,
      rank: i + 1,
      season,
      weekStart: start,
      weekEnd: end,
      prizeTon: prize?.tonAmount,
    })
  }

  await LeaderboardEntry.deleteMany({ season, weekStart: start })
  await LeaderboardEntry.insertMany(entries)

  logger.info(`Leaderboard saved: ${entries.length} entries for season ${season}`)
}

export async function getLeaderboard(limit = 50) {
  const season = getCurrentSeason()
  const { start, end } = getWeekBoundaries()

  const entries = await LeaderboardEntry.find({ season, weekStart: start })
    .sort({ rank: 1 })
    .limit(limit)
    .lean()

  return {
    season,
    totalParticipants: entries.length,
    prizePool: PRIZE_POOL_TON,
    distribution: DISTRIBUTION,
    weekStart: start,
    weekEnd: end,
    entries,
  }
}

export function startLeaderboardCron() {
  cron.schedule('0 0 * * 0', async () => {
    logger.info('Weekly leaderboard cron triggered')
    try {
      await calculateAndSaveLeaderboard()

      await User.updateMany(
        {},
        {
          $set: {
            allocations: { BTC: 0, GOLD: 0, OIL: 0 },
            initialPrices: { BTC: null, GOLD: null, OIL: null },
            portfolioValue: 100,
            totalPnl: 0,
            totalPnlPercent: 0,
            weekStart: new Date(),
          },
        },
      )

      logger.info('Weekly reset completed')
    } catch (error) {
      logger.error('Weekly leaderboard cron failed', { error })
    }
  })
}
