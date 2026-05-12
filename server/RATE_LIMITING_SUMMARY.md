# 🛡️ Socket.io Rate Limiting - خلاصه پیاده‌سازی

## ✅ چه کارهایی انجام شد؟

### 1. نصب پکیج
```bash
npm install rate-limiter-flexible
```

### 2. ایجاد Middleware امنیتی
📁 `server/src/middleware/socketRateLimit.ts`

**4 لایه امنیتی:**
- ✅ **Connection Rate Limiter**: 3 اتصال در 10 ثانیه
- ✅ **Concurrent Connection Limiter**: حداکثر 5 اتصال همزمان از هر IP
- ✅ **Message Rate Limiter**: 2 پیام در 1 ثانیه (طبق درخواست شما)
- ✅ **Authentication Gate**: فقط با JWT معتبر

### 3. به‌روزرسانی Socket Service
📁 `server/src/services/socket.ts`

**تغییرات:**
- ✅ Import middleware جدید
- ✅ حذف کد قدیمی rate limiting
- ✅ اضافه کردن 2 لایه middleware (Rate Limit → Auth)
- ✅ بهبود logging

### 4. به‌روزرسانی Client Hook
📁 `hooks/use-socket.ts`

**تغییرات:**
- ✅ Handle کردن `connect_error` برای rate limit errors
- ✅ Handle کردن `rate_limit_error` برای message spam
- ✅ پیام‌های debug برای troubleshooting

---

## 🎯 محدودیت‌های تنظیم شده

| نوع محدودیت | مقدار | توضیح |
|------------|-------|-------|
| **Connection Rate** | 3 در 10 ثانیه | جلوی reconnection spam |
| **Concurrent Connections** | 5 اتصال همزمان | جلوی DDoS |
| **Message Rate** | 2 در 1 ثانیه | جلوی message spam |
| **Block Duration (Connection)** | 60 ثانیه | مدت بلاک اتصال |
| **Block Duration (Message)** | 10 ثانیه | مدت بلاک پیام |

---

## 🔄 Flow اتصال

```
کاربر تلاش برای اتصال
    ↓
[1] بررسی IP Rate Limit (3 در 10 ثانیه)
    ↓ OK
[2] بررسی Concurrent Connections (حداکثر 5)
    ↓ OK
[3] بررسی JWT Token
    ↓ OK
[4] اتصال برقرار شد ✅
    ↓
[5] هر پیام: بررسی Message Rate Limit (2 در 1 ثانیه)
```

---

## 🧪 تست کردن

### تست 1: Connection Rate Limit
```bash
# تلاش برای 5 اتصال سریع
# انتظار: 3 تا موفق، 2 تا بلاک
```

### تست 2: Message Rate Limit
```javascript
// در browser console
for (let i = 0; i < 5; i++) {
  socket.emit('test', { data: i })
}
// انتظار: 2 تا موفق، بقیه بلاک + دریافت rate_limit_error
```

### تست 3: Concurrent Connections
```bash
# باز کردن 6 تب browser
# انتظار: 5 تا متصل، 6 امی بلاک
```

---

## 📊 Monitoring و Logs

### لاگ‌های مهم:
```
✅ Socket connection allowed for IP: x.x.x.x (1/5)
⚠️ Connection rate limit exceeded for IP: x.x.x.x
⚠️ Max concurrent connections (5) reached for IP: x.x.x.x
⚠️ Message rate limit exceeded for socket: abc123
✅ Socket authenticated successfully for user: 12345
❌ Socket authentication failed from IP: x.x.x.x
```

### مسیر لاگ‌ها:
- `server/logs/combined.log` - همه لاگ‌ها
- `server/logs/error.log` - فقط خطاها

---

## 🔧 تنظیمات (اگر نیاز به تغییر داشتید)

### کاهش محدودیت پیام به 1 در ثانیه:
```typescript
// در socketRateLimit.ts
const messageLimiter = new RateLimiterMemory({
  points: 1,        // تغییر از 2 به 1
  duration: 1,
  blockDuration: 10,
})
```

### افزایش اتصالات همزمان به 10:
```typescript
const MAX_CONNECTIONS_PER_IP = 10  // تغییر از 5 به 10
```

### تغییر مدت بلاک:
```typescript
const connectionLimiter = new RateLimiterMemory({
  points: 3,
  duration: 10,
  blockDuration: 120,  // تغییر از 60 به 120 ثانیه
})
```

---

## 🚀 استفاده در Production

### برای Production پیشنهاد می‌شود:

1. **استفاده از Redis** به جای Memory:
```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'

const redisClient = new Redis(process.env.REDIS_URL)

const connectionLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 3,
  duration: 10,
})
```

2. **استفاده از Cloudflare** برای DDoS protection

3. **IP Whitelist** برای admin users

---

## ⚠️ نکات مهم

1. ✅ **UX خراب نمی‌شود**: کاربر عادی هیچوقت به این محدودیت‌ها نمی‌رسد
2. ✅ **Attacker بلاک می‌شود**: حملات DDoS و spam متوقف می‌شوند
3. ✅ **قابل تنظیم**: همه محدودیت‌ها قابل تغییر هستند
4. ✅ **Logging کامل**: همه رویدادها لاگ می‌شوند
5. ✅ **Error Handling**: کلاینت error های واضح دریافت می‌کند

---

## 📚 فایل‌های مرتبط

- `server/src/middleware/socketRateLimit.ts` - Middleware اصلی
- `server/src/middleware/socketRateLimit.example.ts` - مثال‌های استفاده
- `server/src/middleware/SOCKET_RATE_LIMIT_README.md` - مستندات کامل
- `server/src/services/socket.ts` - Socket service به‌روزرسانی شده
- `hooks/use-socket.ts` - Client hook با error handling

---

## ✅ آماده برای استفاده!

سرور را restart کنید:
```bash
cd server
npm run dev
```

همه چیز آماده است! 🎉
