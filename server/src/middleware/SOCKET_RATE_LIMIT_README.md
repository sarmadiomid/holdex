# Socket.io Rate Limiting Implementation

## 🛡️ لایه‌های امنیتی پیاده‌سازی شده

این پیاده‌سازی شامل **4 لایه امنیتی** برای محافظت در برابر حملات DDoS و Spam است:

### 1️⃣ Connection Rate Limiter (محدودیت سرعت اتصال)
- **محدودیت**: 6 اتصال در 10 ثانیه از هر IP (تغییر از 3 به 6)
- **بلاک**: 60 ثانیه اگر تخطی کرد
- **هدف**: جلوگیری از reconnection spam و botnet attacks

### 2️⃣ Concurrent Connection Limiter (محدودیت اتصالات همزمان)
- **محدودیت**: حداکثر 5 اتصال همزمان از هر IP
- **هدف**: جلوگیری از باز کردن هزاران اتصال همزمان

### 3️⃣ Message Rate Limiter (محدودیت پیام‌ها)
- **محدودیت**: 2 پیام در 1 ثانیه از هر socket
- **بلاک**: 10 ثانیه اگر تخطی کرد
- **هدف**: جلوگیری از spam پیام‌ها

### 4️⃣ Authentication Gate (دروازه احراز هویت)
- **الزامی**: JWT token معتبر برای اتصال
- **هدف**: فقط کاربران احراز هویت شده می‌توانند متصل شوند

---

## 📊 ترتیب اجرای Middlewares

```
Client Connection Request
    ↓
[1] Rate Limiting Check (IP-based)
    ↓
[2] Concurrent Connection Check (IP-based)
    ↓
[3] JWT Authentication Check
    ↓
[4] Connection Established
    ↓
[5] Message Rate Limiting (per socket)
```

---

## 🔧 استفاده در Event Handlers

اگر می‌خواهید روی event های خاص rate limiting اعمال کنید:

```typescript
import { checkMessageRateLimit, rateLimitedHandler } from '../middleware/socketRateLimit'

// روش 1: استفاده مستقیم
socket.on('custom_event', async (data) => {
  const canProceed = await checkMessageRateLimit(socket, 'custom_event')
  if (!canProceed) return // Rate limit exceeded
  
  // پردازش event
})

// روش 2: استفاده از wrapper
socket.on('custom_event', rateLimitedHandler(async (socket, data) => {
  // پردازش event
}))
```

---

## ⚙️ تنظیمات قابل تغییر

در فایل `socketRateLimit.ts`:

```typescript
// تنظیمات Connection Rate Limiter
const connectionLimiter = new RateLimiterMemory({
  points: 6,           // تعداد اتصال مجاز (تغییر از 3 به 6)
  duration: 10,        // در چند ثانیه
  blockDuration: 60,   // مدت زمان بلاک (ثانیه)
})

// تنظیمات Message Rate Limiter
const messageLimiter = new RateLimiterMemory({
  points: 2,           // تعداد پیام مجاز
  duration: 1,         // در چند ثانیه
  blockDuration: 10,   // مدت زمان بلاک (ثانیه)
})

// تنظیمات Concurrent Connections
const MAX_CONNECTIONS_PER_IP = 5  // حداکثر اتصال همزمان
```

---

## 📝 لاگ‌های مهم

سیستم لاگ‌های زیر را ثبت می‌کند:

- ✅ **Connection allowed**: اتصال موفق
- ⚠️ **Rate limit exceeded**: تخطی از محدودیت سرعت
- ⚠️ **Max concurrent connections**: تخطی از تعداد اتصالات همزمان
- ⚠️ **Message rate limit exceeded**: تخطی از محدودیت پیام
- ❌ **Authentication failed**: خطای احراز هویت

---

## 🧪 تست کردن

### تست Connection Rate Limit:
```bash
# تلاش برای 5 اتصال سریع (باید 4 تای آخر بلاک شود)
for i in {1..5}; do
  curl -X POST http://localhost:4000/socket.io/ &
done
```

### تست Message Rate Limit:
```javascript
// در client
for (let i = 0; i < 10; i++) {
  socket.emit('test_event', { data: i })
}
// پیام‌های بعد از 2 تا باید بلاک شوند
```

---

## 🚨 Error Handling در Client

کلاینت باید این error ها را handle کند:

```typescript
// در hooks/use-socket.ts
socket.on('connect_error', (error) => {
  if (error.message.includes('rate limit')) {
    // نمایش پیام: "لطفاً کمی صبر کنید"
  }
  if (error.message.includes('Authentication required')) {
    // redirect به صفحه login
  }
})

socket.on('rate_limit_error', (data) => {
  // نمایش toast: "پیام‌های زیادی ارسال کردید. لطفاً {data.retryAfter} ثانیه صبر کنید"
})
```

---

## 📈 مانیتورینگ

برای مانیتورینگ rate limiting می‌توانید:

1. لاگ‌های Winston را بررسی کنید
2. متریک‌های زیر را track کنید:
   - تعداد اتصالات بلاک شده
   - تعداد پیام‌های بلاک شده
   - IP های مشکوک

---

## 🔐 امنیت بیشتر (اختیاری)

برای امنیت بیشتر می‌توانید:

1. **IP Blacklist**: IP های مشکوک را در Redis ذخیره کنید
2. **Cloudflare**: از Cloudflare برای DDoS protection استفاده کنید
3. **Redis Rate Limiter**: برای production از Redis به جای Memory استفاده کنید

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'

const redisClient = new Redis({ /* config */ })

const connectionLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 6,  // تغییر از 3 به 6
  duration: 10,
})
```

---

## ✅ تست شده برای:

- ✅ کاربر عادی: هیچ محدودیتی احساس نمی‌کند
- ✅ Reconnection: اتصال مجدد بدون مشکل
- ✅ Multiple tabs: چند تب باز بدون مشکل (تا 5 تب)
- ✅ DDoS attack: حملات بلاک می‌شوند
- ✅ Message spam: پیام‌های spam بلاک می‌شوند

---

## 🎯 نتیجه

این پیاده‌سازی:
- ✅ UX را خراب نمی‌کند
- ✅ از حملات DDoS محافظت می‌کند
- ✅ از spam پیام‌ها جلوگیری می‌کند
- ✅ فقط کاربران احراز هویت شده را می‌پذیرد
- ✅ قابل تنظیم و مقیاس‌پذیر است
