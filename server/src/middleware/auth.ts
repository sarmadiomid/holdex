import { Request, Response, NextFunction } from 'express'
import * as jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthRequest extends Request {
  userId?: string
  telegramId?: number
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string
      telegramId: number
    }
    req.userId = decoded.userId
    req.telegramId = decoded.telegramId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
