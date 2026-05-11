# رفع مشکل Flicker در نمایش Portfolio Value

## شرح مشکل

### علائم:
وقتی کاربر مقداری از موجودی خود را allocate می‌کرد (مثلاً 250 HLX از 1000 HLX روی BTC)، با تغییرات لحظه‌ای قیمت، مقدار کل HLX در header و dashboard به صورت متناوب بین دو مقدار toggle می‌شد:

```
750 HLX → 1001 HLX → 750 HLX → 1002 HLX → 750 HLX → 999 HLX → ...
```

بعد از چند تکرار، به روند صحیح برمی‌گشت و فقط یکی از مقادیر نمایش داده می‌شد.

### علت ریشه‌ای:

**Conflict بین محاسبات Frontend و Backend:**

1. **Frontend** (`lib/store.ts` - تابع `updateAssetPrice`):
   - وقتی `price_update` socket event دریافت می‌شد
   - Frontend خودش portfolio value را محاسبه می‌کرد
   - نتیجه: نمایش 1001 HLX (با محاسبه allocated + unallocated)

2. **Backend** (`server/src/services/twelveData.ts`):
   - همزمان با price update، `recalcAndBroadcastUser` اجرا می‌شد
   - یک `user_update` socket event ارسال می‌کرد
   - نتیجه: نمایش 750 HLX (فقط balance بدون allocated)

3. **Race Condition**:
   - این دو update به صورت متناوب اجرا می‌شدند
   - باعث flicker بین دو مقدار می‌شد
   - بعد از چند بار، یکی از آنها "می‌برد" و دیگری متوقف می‌شد

### جریان مشکل:

```
Price Update از TwelveData
    ↓
    ├─→ Frontend: updateAssetPrice() → محاسبه portfolio → 1001 HLX
    │
    └─→ Backend: recalcAndBroadcastUser() → user_update event → 750 HLX
            ↓
        Frontend: updateUserFromSocket() → override portfolio → 750 HLX
            ↓
        Frontend: updateAssetPrice() دوباره → 1002 HLX
            ↓
        ... (تکرار)
```

## راه حل

### اصل راه حل:
**Backend = Single Source of Truth**

فقط backend باید portfolio value را محاسبه کند و frontend فقط نمایش دهد.

### تغییرات انجام شده:

#### 1. حذف محاسبات Frontend در `updateAssetPrice` (`lib/store.ts`)

**قبل:**
```typescript
updateAssetPrice: (twelveDataSymbol, price) => {
  // ... update asset price
  
  // ❌ Frontend خودش portfolio را محاسبه می‌کرد
  const multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }
  let totalValue = 0
  // ... محاسبات پیچیده
  
  return {
    assets: updatedAssets,
    user: {
      ...state.user,
      portfolioValue: totalValue,  // ❌ Conflict با backend
      totalPnl: pnl,
      totalPnlPercent: pnlPercent,
    },
  }
}
```

**بعد:**
```typescript
updateAssetPrice: (twelveDataSymbol, price) => {
  // ... update asset price
  
  // ✅ فقط قیمت asset را update می‌کند
  // ✅ Portfolio value از backend دریافت می‌شود
  return {
    assets: updatedAssets,
    // user object را update نمی‌کند
  }
}
```

#### 2. حذف محاسبات Frontend در `setUserPrices` (`lib/store.ts`)

این تابع هم فقط قیمت‌های asset را update می‌کند و portfolio را محاسبه نمی‌کند.

### جریان صحیح بعد از رفع مشکل:

```
Price Update از TwelveData
    ↓
    ├─→ Frontend: updateAssetPrice() → فقط update قیمت asset
    │
    └─→ Backend: recalcAndBroadcastUser() → محاسبه portfolio
            ↓
        Backend: user_update event → ارسال portfolio صحیح
            ↓
        Frontend: updateUserFromSocket() → نمایش portfolio از backend
            ↓
        ✅ نمایش صحیح و بدون flicker
```

## مزایای راه حل:

1. **Single Source of Truth**: فقط backend محاسبه می‌کند
2. **عدم Conflict**: دیگر دو محاسبه با هم تداخل ندارند
3. **Consistency**: همه کاربران مقدار یکسان را می‌بینند
4. **Performance**: Frontend دیگر محاسبات سنگین انجام نمی‌دهد
5. **Maintainability**: منطق محاسبه فقط در یک جا (backend) است

## تست:

برای تست رفع مشکل:

1. 1000 HLX موجودی داشته باشید
2. 250 HLX را روی BTC allocate کنید
3. منتظر تغییرات قیمت بمانید
4. مقدار portfolio در header باید ثابت و بدون flicker باشد
5. مقدار باید بین 750 + سود/ضرر باشد (نه 750 ثابت)

## فایل‌های تغییر یافته:

- `lib/store.ts`: حذف محاسبات portfolio از `updateAssetPrice` و `setUserPrices`

## نکات مهم:

- Backend همچنان با `recalcAndBroadcastUser` portfolio را محاسبه و broadcast می‌کند
- Frontend فقط از `user_update` socket event استفاده می‌کند
- تابع `updatePortfolioValue` در store همچنان وجود دارد برای موارد خاص (مثل sell all)
