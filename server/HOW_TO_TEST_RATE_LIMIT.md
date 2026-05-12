# 🧪 نحوه تست Rate Limiting

## روش 1: استفاده از HTML Tester (ساده‌ترین روش)

### مرحله 1: دریافت JWT Token
1. سرور را اجرا کنید:
```bash
cd server
npm run dev
```

2. به endpoint زیر درخواست بدهید تا JWT بگیرید:
```bash
# مثال با curl
curl -X POST http://localhost:4000/api/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"initData": "YOUR_TELEGRAM_INIT_DATA"}'
```

یا از Postman استفاده کنید.

### مرحله 2: باز کردن HTML Tester
1. فایل `test-rate-limit.html` را در مرورگر باز کنید
2. توکن JWT را در فیلد مربوطه paste کنید
3. روی دکمه "اتصال" کلیک کنید

### مرحله 3: اجرای تست‌ها
- **تست 1**: Connection Rate Limit - 5 اتصال سریع
- **تست 2**: Message Rate Limit - 5 پیام سریع
- **تست 3**: Concurrent Connections - 6 اتصال همزمان

---

## روش 2: تست با Browser Console

### تست Connection Rate Limit:
```javascript
// باز کردن Console (F12)
const token = 'YOUR_JWT_TOKEN';

// تلاش برای 5 اتصال سریع
for (let i = 0; i < 5; i++) {
  const socket = io('http://localhost:4000', {
    auth: { token }
  });
  
  socket.on('connect', () => console.log(`✅ Connection ${i+1} success`));
  socket.on('connect_error', (err) => console.log(`❌ Connection ${i+1} blocked:`, err.message));
}

// انتظار: 3 موفق، 2 بلاک
```

### تست Message Rate Limit:
```javascript
const socket = io('http://localhost:4000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected');
  
  // ارسال 5 پیام سریع
  for (let i = 0; i < 5; i++) {
    socket.emit('test_message', { count: i });
    console.log(`📤 Message ${i+1} sent`);
  }
});

socket.on('rate_limit_error', (data) => {
  console.log('⚠️ Rate limit:', data);
});

// انتظار: 2 پیام موفق، بقیه rate_limit_error
```

### تست Concurrent Connections:
```javascript
const token = 'YOUR_JWT_TOKEN';
const sockets = [];

// باز کردن 6 اتصال همزمان
for (let i = 0; i < 6; i++) {
  const socket = io('http://localhost:4000', {
    auth: { token }
  });
  
  socket.on('connect', () => console.log(`✅ Socket ${i+1} connected`));
  socket.on('connect_error', (err) => console.log(`❌ Socket ${i+1} blocked:`, err.message));
  
  sockets.push(socket);
}

// انتظار: 5 موفق، 1 بلاک

// بستن همه اتصالات بعد از 5 ثانیه
setTimeout(() => {
  sockets.forEach(s => s.disconnect());
  console.log('All sockets disconnected');
}, 5000);
```

---

## روش 3: تست با cURL (برای Connection Rate Limit)

```bash
# تست سریع - 5 درخواست همزمان
for i in {1..5}; do
  curl -X POST http://localhost:4000/socket.io/ \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" &
done
wait

# بررسی لاگ‌ها
tail -f server/logs/combined.log
```

---

## روش 4: تست با Postman/Insomnia

### تست WebSocket Connection:
1. ایجاد WebSocket Request
2. URL: `ws://localhost:4000/socket.io/?EIO=4&transport=websocket`
3. Headers: `Authorization: Bearer YOUR_JWT_TOKEN`
4. تلاش برای چند اتصال سریع

---

## 📊 نتایج مورد انتظار

### ✅ تست موفق Connection Rate Limit:
```
✅ Connection 1: Success
✅ Connection 2: Success
✅ Connection 3: Success
❌ Connection 4: Blocked (rate limit exceeded)
❌ Connection 5: Blocked (rate limit exceeded)
```

### ✅ تست موفق Message Rate Limit:
```
📤 Message 1: Sent
📤 Message 2: Sent
⚠️ Message 3: rate_limit_error (wait 10s)
⚠️ Message 4: rate_limit_error (wait 10s)
⚠️ Message 5: rate_limit_error (wait 10s)
```

### ✅ تست موفق Concurrent Connections:
```
✅ Socket 1: Connected
✅ Socket 2: Connected
✅ Socket 3: Connected
✅ Socket 4: Connected
✅ Socket 5: Connected
❌ Socket 6: Blocked (max concurrent connections)
```

---

## 🔍 بررسی لاگ‌ها

### مشاهده لاگ‌های زنده:
```bash
# همه لاگ‌ها
tail -f server/logs/combined.log

# فقط خطاها
tail -f server/logs/error.log

# فیلتر rate limit
tail -f server/logs/combined.log | grep "rate limit"
```

### لاگ‌های مورد انتظار:
```
✅ Socket connection allowed for IP: 127.0.0.1 (1/5)
⚠️ Connection rate limit exceeded for IP: 127.0.0.1. Retry after 10s
⚠️ Max concurrent connections (5) reached for IP: 127.0.0.1
⚠️ Message rate limit exceeded for socket: abc123
✅ Socket authenticated successfully for user: 12345
```

---

## 🐛 Troubleshooting

### مشکل: همه اتصالات موفق می‌شوند (rate limit کار نمی‌کند)
**راه‌حل:**
1. مطمئن شوید سرور restart شده
2. بررسی کنید middleware به درستی import شده
3. لاگ‌ها را بررسی کنید

### مشکل: همه اتصالات بلاک می‌شوند
**راه‌حل:**
1. بررسی کنید JWT token معتبر است
2. بررسی کنید سرور در حال اجرا است
3. CORS را بررسی کنید

### مشکل: rate_limit_error دریافت نمی‌شود
**راه‌حل:**
1. مطمئن شوید client به event گوش می‌دهد:
```javascript
socket.on('rate_limit_error', (data) => {
  console.log('Rate limit:', data);
});
```

---

## 📝 چک‌لیست تست

- [ ] Connection Rate Limit: 3 موفق، 2 بلاک
- [ ] Message Rate Limit: 2 موفق، بقیه بلاک
- [ ] Concurrent Connections: 5 موفق، 6 امی بلاک
- [ ] JWT Authentication: بدون token بلاک می‌شود
- [ ] Error Messages: پیام‌های واضح دریافت می‌شود
- [ ] Logging: لاگ‌ها به درستی ثبت می‌شوند
- [ ] Client Error Handling: error ها در client handle می‌شوند

---

## 🎯 نتیجه

اگر همه تست‌ها موفق بودند، rate limiting به درستی کار می‌کند! 🎉

برای سوالات بیشتر، فایل `SOCKET_RATE_LIMIT_README.md` را مطالعه کنید.
