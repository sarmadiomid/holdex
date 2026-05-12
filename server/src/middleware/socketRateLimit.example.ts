/**
 * مثال‌های استفاده از Socket Rate Limiting
 * این فایل فقط برای مرجع است و در production استفاده نمی‌شود
 */

import { Server } from 'socket.io'
import { checkMessageRateLimit, rateLimitedHandler } from './socketRateLimit'

export function exampleUsage(io: Server) {
  io.on('connection', (socket) => {
    // ✅ مثال 1: استفاده مستقیم از checkMessageRateLimit
    socket.on('send_message', async (data) => {
      // بررسی rate limit قبل از پردازش
      const canProceed = await checkMessageRateLimit(socket, 'send_message')
      if (!canProceed) {
        // Rate limit exceeded - پیام خطا به کاربر ارسال شده
        return
      }

      // پردازش پیام
      console.log('Processing message:', data)
      socket.emit('message_sent', { success: true })
    })

    // ✅ مثال 2: استفاده از wrapper function
    socket.on(
      'update_allocation',
      rateLimitedHandler(async (socket, data) => {
        // این کد فقط اگر rate limit OK باشد اجرا می‌شود
        console.log('Updating allocation:', data)
        socket.emit('allocation_updated', { success: true })
      }),
    )

    // ✅ مثال 3: Event بدون rate limiting (برای broadcast ها)
    socket.on('subscribe_prices', (data) => {
      // این event نیاز به rate limiting ندارد
      // چون فقط یک بار subscribe می‌شود
      socket.join('price_updates')
      console.log('User subscribed to price updates')
    })

    // ✅ مثال 4: Multiple events با rate limiting
    const rateLimitedEvents = [
      'place_order',
      'cancel_order',
      'update_profile',
      'send_chat',
    ]

    rateLimitedEvents.forEach((eventName) => {
      socket.on(
        eventName,
        rateLimitedHandler(async (socket, data) => {
          console.log(`Processing ${eventName}:`, data)
          socket.emit(`${eventName}_success`, { success: true })
        }),
      )
    })

    // ✅ مثال 5: Custom error handling
    socket.on('critical_action', async (data) => {
      const canProceed = await checkMessageRateLimit(socket, 'critical_action')
      if (!canProceed) {
        // Custom error handling
        socket.emit('critical_action_failed', {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'این عملیات خیلی سریع انجام شد. لطفاً کمی صبر کنید.',
        })
        return
      }

      // پردازش عملیات حساس
      console.log('Processing critical action:', data)
    })
  })
}

/**
 * نکات مهم:
 * 
 * 1. از checkMessageRateLimit برای event هایی که کاربر trigger می‌کند استفاده کنید
 * 2. از rateLimitedHandler برای کد تمیزتر استفاده کنید
 * 3. Event های broadcast (emit از سمت سرور) نیاز به rate limiting ندارند
 * 4. Event های subscribe/unsubscribe معمولاً نیاز به rate limiting ندارند
 * 5. فقط event هایی که ممکن است spam شوند را rate limit کنید
 */
