import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'

vi.mock('../db/models/User', () => {
  const save = vi.fn().mockResolvedValue(undefined)
  const user = {
    telegramId: 12345,
    assetLeverages: { BTC: 1, GOLD: 1, EUR: 1 },
    save,
  }
  return {
    User: {
      findOne: vi.fn().mockResolvedValue(user),
    },
    __user: user,
  }
})

vi.mock('../db/models/Position', () => ({
  Position: { create: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../services/socket', () => ({
  recalcAndBroadcastUser: vi.fn(),
  broadcastAllocationUpdate: vi.fn(),
  broadcastUserUpdate: vi.fn(),
  getLatestPrices: vi.fn().mockReturnValue({}),
}))

vi.mock('../services/leaderboard', () => ({
  getTournamentPhase: vi.fn().mockReturnValue('active'),
}))

vi.mock('../middleware/rateLimit', () => ({
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  allocationLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import allocationRoutes from '../routes/allocation'
import { User } from '../db/models/User'
import { broadcastUserUpdate } from '../services/socket'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api', allocationRoutes)
  return app
}

function authHeader() {
  const token = jwt.sign(
    { userId: 'u1', telegramId: 12345 },
    process.env.JWT_SECRET as string,
  )
  return `Bearer ${token}`
}

describe('asset-leverage endpoint mount path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(User.findOne as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      telegramId: 12345,
      assetLeverages: { BTC: 1, GOLD: 1, EUR: 1 },
      save: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('persists asset leverage at POST /api/asset-leverage', async () => {
    const app = buildApp()

    const res = await request(app)
      .post('/api/asset-leverage')
      .set('Authorization', authHeader())
      .send({ asset: 'BTC', leverage: 5 })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      success: true,
      assetLeverages: { BTC: 5 },
    })
    expect(broadcastUserUpdate).toHaveBeenCalledWith(
      12345,
      expect.objectContaining({ assetLeverages: expect.objectContaining({ BTC: 5 }) }),
    )
  })

  it('does not respond at the legacy POST /api/allocation/asset-leverage path (regression guard)', async () => {
    const app = buildApp()

    const res = await request(app)
      .post('/api/allocation/asset-leverage')
      .set('Authorization', authHeader())
      .send({ asset: 'BTC', leverage: 5 })

    expect(res.status).toBe(404)
  })
})
