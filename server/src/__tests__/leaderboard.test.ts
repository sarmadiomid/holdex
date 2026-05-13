import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'

vi.mock('../db/models/User', () => ({
  User: {
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../services/leaderboard', () => {
  const start = new Date('2026-01-04T00:00:00Z')
  const end = new Date('2026-01-11T00:00:00Z')
  return {
    getLeaderboard: vi.fn().mockResolvedValue({
      season: 1,
      totalParticipants: 100,
      prizePool: 500,
      distribution: [],
      weekStart: start,
      weekEnd: end,
      phase: 'active',
      phaseEndsAt: new Date('2026-01-09T23:59:59Z'),
      nextPhaseStartsAt: new Date('2026-01-12T00:00:00Z'),
      entries: [],
    }),
    getWeekBoundaries: vi.fn().mockReturnValue({ start, end }),
  }
})

const WEEK_START = new Date('2026-01-04T00:00:00Z')
const WEEK_END = new Date('2026-01-11T00:00:00Z')

vi.mock('../middleware/rateLimit', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  allocationLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import leaderboardRoutes from '../routes/leaderboard'
import { User } from '../db/models/User'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', leaderboardRoutes)
  return app
}

function authHeader(telegramId = 12345) {
  const token = jwt.sign(
    { userId: 'u1', telegramId },
    process.env.JWT_SECRET as string,
  )
  return `Bearer ${token}`
}

type Mock = ReturnType<typeof vi.fn>

describe('GET /api/leaderboard — userPosition.rank', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports rank 47 when 46 users have a higher portfolioValue', async () => {
    ;(User.findOne as unknown as Mock).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        portfolioValue: 150,
        totalPnl: 10,
        totalPnlPercent: 5,
      }),
    })
    ;(User.countDocuments as unknown as Mock).mockResolvedValue(46)

    const app = buildApp()
    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', authHeader())

    expect(res.status).toBe(200)
    expect(res.body.userPosition).toMatchObject({
      rank: 47,
      portfolioValue: 150,
      pnl: 10,
      pnlPercent: 5,
    })

    const filter = (User.countDocuments as unknown as Mock).mock.calls[0][0]
    expect(filter.portfolioValue).toEqual({ $gt: 150 })
    // Regression guard: rank must window on the current week, not equality
    // on this user's per-row weekStart.
    expect(filter.weekStart).toEqual({ $gte: WEEK_START, $lt: WEEK_END })
  })

  it('reports rank 1 when no user has a higher portfolioValue', async () => {
    ;(User.findOne as unknown as Mock).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        portfolioValue: 999,
        totalPnl: 100,
        totalPnlPercent: 50,
      }),
    })
    ;(User.countDocuments as unknown as Mock).mockResolvedValue(0)

    const app = buildApp()
    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', authHeader())

    expect(res.status).toBe(200)
    expect(res.body.userPosition).toMatchObject({ rank: 1 })
  })

  it('returns userPosition: null when the user is not found', async () => {
    ;(User.findOne as unknown as Mock).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    })

    const app = buildApp()
    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', authHeader())

    expect(res.status).toBe(200)
    expect(res.body.userPosition).toBeNull()
    expect(User.countDocuments).not.toHaveBeenCalled()
  })
})
