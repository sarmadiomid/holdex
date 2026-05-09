import cron from 'node-cron'
import { User } from '../db/models/User'
import { LeaderboardEntry } from '../db/models/Leaderboard'
import { logger } from '../utils/logger'
import mongoose from 'mongoose'

const PRIZE_POOL_TON = 500
const DISTRIBUTION = [
  { rank: 1, percentage: 50, tonAmount: 250 },
  { rank: 2, percentage: 30, tonAmount: 150 },
  { rank: 3, percentage: 20, tonAmount: 100 },
]

function getCurrentSeason(): number {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const weekStart = new Date(now)
  weekStart.setUTCDate(now.getUTCDate() - dayOfWeek)
  weekStart.setUTCHours(0, 0, 0, 0)
  const firstMonday2026 = new Date('2026-01-05T00:00:00Z')
  return Math.floor((weekStart.getTime() - firstMonday2026.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
}

export type TournamentPhase = 'active' | 'cooldown'

export function getTournamentPhase(): TournamentPhase {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const hour = now.getUTCHours()
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'cooldown'
  }
  
  if (dayOfWeek === 5 && hour >= 23) {
    return 'cooldown'
  }
  
  return 'active'
}

export function getCurrentPhaseEndTime(): Date {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  
  const end = new Date(now)
  
  if (dayOfWeek === 5) {
    end.setUTCHours(23, 59, 59, 999)
  } else if (dayOfWeek === 6 || dayOfWeek === 0) {
    const daysUntilFriday = (7 - dayOfWeek + 5) % 7
    end.setUTCDate(now.getUTCDate() + daysUntilFriday)
    end.setUTCHours(23, 59, 59, 999)
  } else {
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7
    if (daysUntilFriday === 0) {
      end.setUTCHours(23, 59, 59, 999)
    } else {
      end.setUTCDate(now.getUTCDate() + daysUntilFriday)
      end.setUTCHours(23, 59, 59, 999)
    }
  }
  
  return end
}

export function getNextPhaseStartTime(): Date {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const hour = now.getUTCHours()
  
  const start = new Date(now)
  
  if (dayOfWeek === 5 && hour >= 23) {
    start.setUTCDate(start.getUTCDate() + 3)
    start.setUTCHours(0, 0, 0, 0)
  } else if (dayOfWeek === 6) {
    start.setUTCDate(start.getUTCDate() + 2)
    start.setUTCHours(0, 0, 0, 0)
  } else if (dayOfWeek === 0) {
    start.setUTCDate(start.getUTCDate() + 1)
    start.setUTCHours(0, 0, 0, 0)
  } else {
    start.setUTCHours(0, 0, 0, 0)
  }
  
  return start
}

export function getWeekBoundaries(): { start: Date; end: Date } {
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
    .sort({ portfolioValue: -1 })
    .lean()

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

export async function getLeaderboard(limit = 500) {
  const season = getCurrentSeason()
  const { start, end } = getWeekBoundaries()
  const phase = getTournamentPhase()
  const phaseEndsAt = getCurrentPhaseEndTime()
  const nextPhaseStartsAt = getNextPhaseStartTime()

  const [users, totalCount] = await Promise.all([
    User.find({ weekStart: { $gte: start } })
      .sort({ portfolioValue: -1 })
      .limit(limit)
      .lean(),
    User.countDocuments({ weekStart: { $gte: start } }),
  ])

  const entries = users.map((user, i) => {
    const prize = DISTRIBUTION.find((d) => d.rank === i + 1)
    return {
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
    }
  })

  return {
    season,
    totalParticipants: totalCount,
    prizePool: PRIZE_POOL_TON,
    distribution: DISTRIBUTION,
    weekStart: start,
    weekEnd: end,
    phase,
    phaseEndsAt,
    nextPhaseStartsAt,
    entries,
  }
}

export function startLeaderboardCron() {
  cron.schedule('59 23 * * 5', async () => {
    logger.info('Friday archive cron triggered - saving final leaderboard')
    try {
      await calculateAndSaveLeaderboard()
      logger.info('Friday archive completed')
    } catch (error) {
      logger.error('Friday archive cron failed', { error })
    }
  })

  cron.schedule('0 0 * * 0', async () => {
    logger.info('Weekly reset cron triggered')
    try {
      await User.updateMany(
        {},
        {
          $set: {
            allocations: { BTC: 0, GOLD: 0, EUR: 0 },
            initialPrices: { BTC: null, GOLD: null, EUR: null },
            portfolioValue: 100,
            totalPnl: 0,
            totalPnlPercent: 0,
            weekStart: new Date(),
          },
        },
      )

      logger.info('Weekly reset completed')
    } catch (error) {
      logger.error('Weekly reset cron failed', { error })
    }
  })
}
