import { Socket } from 'socket.io'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { logger } from '../utils/logger'

// 1. Connection Rate Limiter (per IP) - محدودیت سرعت اتصال
const connectionLimiter = new RateLimiterMemory({
  points: 6, // 6 اتصال (تغییر از 3 به 6)
  duration: 10, // در 10 ثانیه
  blockDuration: 60, // بلاک 60 ثانیه اگر تخطی کرد
})

// 2. Message Rate Limiter (per socket) - محدودیت پیام‌ها
const messageLimiter = new RateLimiterMemory({
  points: 2, // 2 پیام
  duration: 1, // در 1 ثانیه
  blockDuration: 10, // بلاک 10 ثانیه
})

// 3. Concurrent Connection Tracker (per IP) - شمارش اتصالات همزمان
const connectionCount = new Map<string, Set<string>>()
const MAX_CONNECTIONS_PER_IP = 5

/**
 * Middleware برای محدودسازی اتصالات Socket.io
 * این middleware قبل از authentication اجرا می‌شود
 */
export const socketRateLimitMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  const ip = socket.handshake.address

  try {
    // بررسی تعداد اتصالات همزمان از این IP
    const currentConnections = connectionCount.get(ip) || new Set()
    if (currentConnections.size >= MAX_CONNECTIONS_PER_IP) {
      logger.warn(
        `Max concurrent connections (${MAX_CONNECTIONS_PER_IP}) reached for IP: ${ip}`,
      )
      return next(new Error('Too many concurrent connections from this IP'))
    }

    // بررسی سرعت برقراری اتصال (Rate Limiting)
    await connectionLimiter.consume(ip)

    // افزایش شمارنده اتصالات همزمان
    currentConnections.add(socket.id)
    connectionCount.set(ip, currentConnections)

    logger.info(
      `Socket connection allowed for IP: ${ip} (${currentConnections.size}/${MAX_CONNECTIONS_PER_IP})`,
    )

    // کاهش شمارنده هنگام disconnect
    socket.on('disconnect', () => {
      const connections = connectionCount.get(ip)
      if (connections) {
        connections.delete(socket.id)
        if (connections.size === 0) {
          connectionCount.delete(ip)
        }
        logger.info(
          `Socket disconnected for IP: ${ip} (${connections.size}/${MAX_CONNECTIONS_PER_IP} remaining)`,
        )
      }
    })

    next()
  } catch (error) {
    if (error instanceof Error && 'msBeforeNext' in error) {
      const rateLimitError = error as { msBeforeNext: number }
      const waitSeconds = Math.ceil(rateLimitError.msBeforeNext / 1000)
      logger.warn(
        `Connection rate limit exceeded for IP: ${ip}. Retry after ${waitSeconds}s`,
      )
      return next(
        new Error(
          `Connection rate limit exceeded. Please try again in ${waitSeconds} seconds`,
        ),
      )
    }
    logger.error(`Socket rate limit error for IP: ${ip}`, error)
    next(new Error('Rate limit error'))
  }
}

/**
 * Rate limiter برای پیام‌های Socket
 * این تابع باید در event handlers استفاده شود
 */
export const checkMessageRateLimit = async (
  socket: Socket,
  eventName: string,
): Promise<boolean> => {
  try {
    await messageLimiter.consume(socket.id)
    return true
  } catch (error) {
    if (error instanceof Error && 'msBeforeNext' in error) {
      const rateLimitError = error as { msBeforeNext: number }
      const waitSeconds = Math.ceil(rateLimitError.msBeforeNext / 1000)
      logger.warn(
        `Message rate limit exceeded for socket: ${socket.id} on event: ${eventName}`,
      )
      socket.emit('rate_limit_error', {
        message: `Too many messages. Please wait ${waitSeconds} seconds`,
        event: eventName,
        retryAfter: waitSeconds,
      })
    }
    return false
  }
}

/**
 * Wrapper برای event handlers که rate limiting را اعمال می‌کند
 */
export const rateLimitedHandler = <T = any>(
  handler: (socket: Socket, data: T) => void | Promise<void>,
) => {
  return async (socket: Socket, data: T) => {
    const canProceed = await checkMessageRateLimit(socket, 'custom_event')
    if (canProceed) {
      await handler(socket, data)
    }
  }
}
