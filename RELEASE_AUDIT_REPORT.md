# Release Readiness Audit Report

**Generated:** May 11, 2026
**Auditor:** Senior Full-Stack Engineer / Product Manager / Growth Marketer
**Overall Release Readiness Score:** 62/100

---

## Executive Summary

Holdex is a Telegram Mini App investment simulator with a cyberpunk neon UI, real-time price feeds via TwelveData, weekly leaderboard tournaments with TON prizes, and Telegram Stars payments. The codebase demonstrates solid architectural decisions (Next.js + Express + MongoDB + Socket.IO) and good Telegram SDK integration. However, it has significant pre-release gaps: no automated testing, missing CSRF protection, no Redis caching, hardcoded English strings, basic rate limiting, and several potential race conditions in financial operations. The app is functionally complete but requires hardening before production scale.

---

## 🔴 Critical Blockers (12 items)

| # | Issue | File/Location | Why Critical | Fix Required |
|---|-------|---------------|--------------|--------------|
| 1 | **Images unoptimized** | `next.config.mjs:7` | `images.unoptimized: true` disables Next.js image optimization, causing large payload sizes and slow loads on mobile networks. | Remove this line; use `next/image` with proper sizing. |
| 2 | **No CSRF protection** | `server/src/index.ts:88-221` | Telegram webhook and API endpoints lack CSRF tokens. While auth uses JWT, state-changing POSTs without CSRF are vulnerable to cross-origin attacks. | Add CSRF token validation for non-Telegram webhook routes or use SameSite cookies. |
| 3 | **No database transactions** | `server/src/routes/allocation.ts:65-84`, `server/src/services/referral.ts:34-68` | Multi-step financial operations (save user + create position + update referrer) are not atomic. A crash mid-operation creates data inconsistency. | Wrap multi-step financial ops in MongoDB transactions (`session.startTransaction()`). |
| 4 | **Optimistic update without rollback** | `lib/store.ts:403-427` | `setAssetLeverage` updates UI optimistically but only logs errors on backend failure — no rollback. Users see wrong leverage. | Add rollback logic in `.catch()` to revert the store state. |
| 5 | **Position history PnL bug** | `server/src/routes/allocation.ts:289-316` | When calculating fallback PnL, code searches `idx + 1` in an array sorted `createdAt: -1`, meaning it looks at **newer** records, not the original allocation. PnL will be incorrect for old records. | Reverse search direction or use a proper correlation query. |
| 6 | **`lev_5x` costs 1 Star** | `server/src/routes/stars.ts:18` | The 5x leverage package is priced at 1 Star instead of a realistic value. This is likely a debug value left in production code. | Set correct price (e.g., 500+ Stars) before release. |
| 7 | **No error tracking** | Entire project | No Sentry, Bugsnag, or similar integration. Production errors are only logged to console/files which are ephemeral on Render free tier. | Add Sentry or Datadog for frontend + backend error tracking. |
| 8 | **JWT 30-day expiry, no refresh** | `server/src/routes/auth.ts:87-91` | Tokens valid for 30 days with no refresh mechanism. Compromised tokens have a 30-day window. Users must re-auth after 30 days with no warning. | Implement refresh token rotation or reduce expiry to 24h with refresh. |
| 9 | **No HTTPS enforcement** | `server/src/index.ts:28-62` | No HSTS header, no redirect from HTTP to HTTPS. Telegram Mini Apps require HTTPS. | Add `strict-transport-security` header and HTTP→HTTPS redirect. |
| 10 | **Missing `start_param` abuse validation** | `server/src/services/auth.ts:67-78` | Referral `start_param` is parsed but never validated for format (max 512 chars, allowed chars). Could be used for injection. | Add regex validation: `/^[A-Za-z0-9_-]{1,512}$/`. |
| 11 | **No automated tests** | Entire project | Zero unit tests, integration tests, or E2E tests. Every release is a manual QA risk. | Add Jest/Vitest for backend, React Testing Library for frontend, and at least 1 E2E smoke test. |
| 12 | **Hardcoded bot username** | `components/pages/earn.tsx:34`, `components/pages/profile.tsx:32` | Referral links hardcode `holdextest_bot` which is a test bot name. Will break in production. | Move to environment variable: `NEXT_PUBLIC_BOT_USERNAME`. |

---

## 🟡 Important Issues (18 items)

| # | Issue | File/Location | Impact | Recommended Fix |
|---|-------|---------------|--------|-----------------|
| 1 | **No Redis caching** | Entire backend | Every leaderboard query hits MongoDB. No price caching. Will degrade under load. | Add Redis for price snapshots and leaderboard caching with 60s TTL. |
| 2 | **No rate limit per user** | `server/src/middleware/rateLimit.ts:4-10` | General limiter is IP-based. A user with rotating IPs can bypass. | Add per-telegramId rate limiting for auth and allocation endpoints. |
| 3 | **No input sanitization on queries** | `server/src/routes/leaderboard.ts:11` | `parseInt(req.query.limit)` can be exploited with large values (DoS). | Add `limit` cap (max 100) and validate with Zod. |
| 4 | **No debouncing on sliders** | `components/allocation/allocation-slider.tsx:74-77` | Every slider tick triggers a haptic and state update. Expensive on low-end devices. | Debounce `handleValueChange` by 150ms. |
| 5 | **No retry logic for API calls** | `components/app-shell.tsx:164-188` | Auth and data fetches have no retry. A single network blip breaks the app. | Add exponential backoff retry (3 attempts) for critical fetches. |
| 6 | **Hardcoded English strings** | All `.tsx` files | 100% of UI text is hardcoded English. Telegram users speak 100+ languages. | Implement `next-i18n` or `react-intl` with at least Russian, Spanish, and Persian. |
| 7 | **No RTL support** | `app/layout.tsx:53` | `lang="en"` with no RTL detection. Arabic/Persian users will have broken layout. | Add `dir="auto"` or dynamic RTL detection. |
| 8 | **No offline handling** | Entire frontend | No service worker, no offline state. App crashes if connection drops during allocation. | Add basic offline detection with a "Reconnecting" banner. |
| 9 | **Missing `BackButton` handling** | `hooks/use-telegram.ts` | `webApp.BackButton` is never configured. Users cannot navigate back naturally in Telegram. | Show/hide BackButton when profile or modals are open; attach `onClick` handler. |
| 10 | **No skeleton screens** | `components/pages/dashboard.tsx:263-266` | Loading states are text-only ("Loading history..."). Poor perceived performance. | Add shimmer/skeleton placeholders for cards and lists. |
| 11 | **No CloudStorage usage** | `lib/store.ts` | Tour completion uses `localStorage`, which is cleared when Telegram WebView resets. | Use `webApp.CloudStorage` for persistent per-user state. |
| 12 | **Weekly reset doesn't reset balance** | `server/src/services/leaderboard.ts:202-214` | `User.updateMany` resets allocations and PnL but does NOT reset `balance` to 100. Users keep their HLX across weeks, breaking tournament fairness. | Reset `balance: 100` in the weekly cron or implement separate "tournament wallet". |
| 13 | **No admin dashboard** | Entire project | No way to monitor active users, fraud, or system health beyond logs. | Add a protected `/admin` route with key metrics and manual intervention tools. |
| 14 | **No analytics events** | Entire frontend | Only Vercel Analytics (page views). No custom events for purchases, allocations, or task completions. | Add Amplitude/Mixpanel or Google Analytics 4 event tracking. |
| 15 | **Winston logs to local files** | `server/src/utils/logger.ts:18-20` | On Render free tier, local files are ephemeral. Errors are lost on restart. | Add Winston transport for external log aggregation (Datadog, Papertrail). |
| 16 | **Missing `viewport-fit=cover`** | `app/layout.tsx:39-45` | Viewport meta lacks `viewport-fit=cover`, causing content to be hidden under dynamic islands/notches. | Add `viewport-fit: 'cover'` to viewport export. |
| 17 | **No PWA manifest** | `public/` | No `manifest.json` or service worker. Cannot be installed as PWA. | Add a minimal manifest for installability. |
| 18 | **Zustand store not persisted** | `lib/store.ts` | On app reload, all state resets. User sees loading screen again. | Persist `token` and `isTourCompleted` to `CloudStorage` or `localStorage`. |

---

## 🟢 Nice to Have (14 items)

1. **Code splitting per tab** — `app-shell.tsx` imports all 5 tabs eagerly. Use `React.lazy()` for non-dashboard tabs.
2. **Reduce animation complexity** — Heavy `framer-motion` animations (glows, orbs) drain battery. Add `prefers-reduced-motion` support.
3. **Image lazy loading** — User avatars (`photoUrl`) and icons load eagerly. Add `loading="lazy"`.
4. **Dark/light theme toggle** — Currently forced dark. Respect Telegram's `themeParams` fully.
5. **Web Vitals monitoring** — Add `web-vitals` library to track LCP, CLS, INP.
6. **A/B testing framework** — No infra to test onboarding variants or pricing changes.
7. **In-app changelog** — No way to communicate updates to users.
8. **Referral QR code generation** — Users could share via QR in addition to link copy.
9. **Bot commands** — `/start`, `/help`, `/leaderboard` commands not implemented.
10. **Push notification strategy** — No bot-driven re-engagement (e.g., "Tournament ends in 1 hour!").
11. **Social proof elements** — No "X users joined today" or live activity feed.
12. **Accessibility audit** — Neon colors may fail WCAG contrast ratios. Audit with axe-core.
13. **Bundle analysis** — Run `next-bundle-analyzer` to find heavy dependencies.
14. **API documentation** — No OpenAPI/Swagger spec for the backend.

---

## Detailed Findings by Category

### 1. 🏗️ Architecture & Code Quality

**Strengths:**
- Clean separation of concerns: Next.js frontend + Express backend + MongoDB.
- Zod validation on all backend routes.
- TypeScript strict mode enabled.
- Good use of custom hooks (`useTelegram`, `useSocket`).
- Consistent file naming and component structure.

**Weaknesses:**
- **Anti-pattern:** `useAppStore` is accessed inside `useEffect` without selectors, causing unnecessary re-renders (`components/app-shell.tsx`).
- **Code smell:** `colorMap` is duplicated in `asset-card.tsx`, `allocation-slider.tsx`, and `dashboard.tsx`. Extract to shared utility.
- **Dead code:** `@radix-ui/react-context-menu`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu` are installed but unused.
- **Commented-out code:** None found, but several `console.log` debug statements in production paths (`app-shell.tsx:21-24`, `store.tsx:417`).
- **Inconsistent error handling:** Frontend uses both `alert()` and toast-less error states.

### 2. 🔐 Security

**Strengths:**
- Telegram `initData` HMAC validation is implemented correctly (`services/auth.ts:21-33`).
- JWT secret required (min 32 chars) via Zod env validation.
- Helmet.js enabled for security headers.
- `express-rate-limit` configured.
- Input validation with Zod on all routes.

**Weaknesses:**
- **CRITICAL:** No CSRF tokens. JWT in `Authorization` header is safe from CSRF, but if cookies are ever introduced, this becomes a vulnerability.
- **CRITICAL:** `images.unoptimized: true` removes Next.js built-in XSS protection for images.
- `Content-Security-Policy` in `next.config.mjs` allows `'unsafe-inline'` for scripts, which weakens XSS defense.
- No SQL/NoSQL injection protection audit beyond Mongoose schemas (generally safe, but complex queries should be reviewed).
- The `generalLimiter` is 100 req/min in production — generous for a financial app.

### 3. ⚡ Performance

**Strengths:**
- Socket.IO for real-time price updates avoids polling overhead.
- `transports: ['polling', 'websocket']` fallback is sensible for mobile networks.
- `AnimatePresence` with `mode="wait"` prevents layout thrashing during tab switches.

**Weaknesses:**
- **CRITICAL:** `images.unoptimized: true` means no WebP conversion, no responsive sizing.
- No lazy loading for tabs — all 5 pages are bundled in the main chunk.
- `framer-motion` animations run on every price tick (`AssetCard` key={asset.price} re-mounts unnecessarily).
- `broadcastAllPrices()` every 30 seconds sends to ALL connected sockets, even if prices haven't changed.
- No CDN for static assets.
- `next/font` loads Geist from Google on every load (subsetting is good, but self-hosting would be faster).

### 4. 📱 Telegram Mini App Compliance

**Strengths:**
- `window.Telegram.WebApp` properly typed and initialized.
- `tg.expand()` and `tg.ready()` called on mount.
- `HapticFeedback` used consistently across interactions.
- `openInvoice` correctly implemented with timeout and promise wrapper.
- `themeParams` type declaration is present.
- Viewport locked (`maximumScale: 1, userScalable: false`) to prevent zoom.

**Weaknesses:**
- **No `MainButton` usage** — Telegram recommends using the native MainButton for primary actions (e.g., "Confirm Allocation").
- **No `BackButton` usage** — Profile modal should use Telegram's BackButton instead of custom X.
- **No CloudStorage** — `localStorage` is used for tour state; will not persist across WebView sessions.
- **Theme handling incomplete** — App forces dark theme regardless of Telegram's `themeParams.bg_color`.
- **No `viewport-stable-height` handling** — Bottom nav may be obscured by Telegram's bottom bar on iOS.
- **No `isClosingConfirmationEnabled`** — Users can accidentally swipe-close the app during a purchase.

### 5. 🎨 UI/UX Quality

**Strengths:**
- Mobile-first design with safe-area padding (`safe-area-pt`, `safe-area-pb`).
- Touch targets are generally > 44px (buttons are 36-48px, but some small icons are 32px).
- Empty states handled (no history, no rankings).
- Loading states present for auth and history.
- Error states for auth and sell errors.
- Consistent cyberpunk design system with neon colors.

**Weaknesses:**
- **No skeleton screens** — Loading is plain text or spinners.
- **Accessibility:** No `aria-label` on icon-only buttons (e.g., profile button in header).
- **Contrast:** `neon-cyan` on dark background may fail WCAG AA for small text.
- **Scroll behavior:** Profile modal uses `overflow-y-auto` but no scroll-lock on body when open.
- **Font size:** Some text is `text-[10px]` which is below recommended 12px minimum for mobile.

### 6. 🧪 Testing & Reliability

**Strengths:**
- Error boundaries present (`error.tsx`, `global-error.tsx`).
- Basic logging with Winston.
- Health check endpoint (`/health`).

**Weaknesses:**
- **Zero tests.** No unit, integration, or E2E tests.
- No test scripts in `package.json`.
- Error boundaries only log to console — no external reporting.
- No circuit breaker for TwelveData WebSocket or Telegram API calls.
- No graceful degradation if backend is down (users see generic "Connection to server failed").

### 7. 🌐 Localization & Internationalization

**Weaknesses:**
- 100% hardcoded English strings.
- No i18n library installed.
- `lang="en"` hardcoded in HTML.
- Date formatting uses `toLocaleDateString('en-US')` exclusively.
- Currency formatting uses `$` hardcoded.
- No RTL support.
- Telegram's `language_code` from `initData` is parsed but never used.

### 8. 📊 Analytics & Monitoring

**Strengths:**
- Vercel Analytics installed for frontend.
- Winston logger for backend with structured JSON in production.

**Weaknesses:**
- No custom event tracking (purchases, allocations, task completions).
- No funnel analysis for onboarding.
- No error tracking (Sentry).
- No performance monitoring (Web Vitals).
- No business metrics dashboard (DAU, retention, ARPU).

### 9. 🚀 Deployment & DevOps

**Strengths:**
- `render.yaml` and `vercel.json` present for quick deployment.
- Environment variable examples provided.
- Separate production and development env examples.

**Weaknesses:**
- No CI/CD pipeline (GitHub Actions, etc.).
- No Docker configuration.
- No staging environment configuration.
- Render free tier has cold starts (documented in `DEPLOY.md` but not solved).
- No blue/green deployment strategy.
- `build` script in server uses `tsc` but `start` uses `dist/index.js` — ensure `dist/` is generated before deploy.

### 10. 📈 Marketing & Growth Readiness

**Strengths:**
- Referral system implemented with deep linking.
- Onboarding tour is well-designed with 6 steps.
- Earn tasks for viral growth (follow, share, invite).
- Telegram Stars payment integration for monetization.
- Prize pool creates urgency with countdown timer.

**Weaknesses:**
- No push notification re-engagement strategy.
- No "share to story" or Telegram-native share features beyond `openTelegramLink`.
- No streak/retention mechanics (e.g., "Come back tomorrow for a bonus").
- No social proof ("1,247 traders competing this week" is mock data).
- Value proposition is clear but could be stronger on first load.
- No email/Telegram DM re-engagement for lapsed users.

### 11. 📋 Documentation

**Strengths:**
- `DEPLOY.md` is comprehensive.
- `REFERRAL_SETUP.md` and `CHANNEL_VERIFICATION_SETUP.md` are detailed.
- Inline comments in complex logic (e.g., webhook handling).

**Weaknesses:**
- **No `README.md`** at project root.
- No API documentation (Swagger/OpenAPI).
- No developer onboarding guide for local setup.
- No architecture decision records (ADRs).

### 12. 📦 Scalability & High-Load Readiness

**Database Scalability:**
- MongoDB indexes present on `telegramId`, `userId+createdAt`, `season+rank`, `weekStart`.
- **Missing:** Compound index on `allocations.BTC` (used in `twelveData.ts:51` query). The dynamic key query `["allocations.${normalizedSymbol}"]: { $gt: 0 }` cannot use the existing `telegramId` index efficiently. This will cause collection scans as users grow.
- No connection pooling tuning (default Mongoose settings).
- No read replicas configured.

**Backend Architecture:**
- Monolith Express app. Fine for early stage, but Socket.IO and HTTP share the same Node process.
- **Bottleneck:** `broadcastAllPrices()` emits to ALL sockets every 30s. At 10k concurrent users, this is 10k messages every 30s — manageable, but at 100k+ becomes a bottleneck.
- **Bottleneck:** `recalcAndBroadcastUser` is called sequentially for every user with an allocation on every price tick. With 1,000 allocated users and 3 ticks/sec, that's 3,000 DB updates/sec.

**Caching Strategy:**
- **No Redis.** Leaderboard is computed from MongoDB on every request.
- Prices are only stored in-memory (`latestPrices`). Lost on server restart.

**API Rate Limiting:**
- General: 100 req/min per IP.
- Auth: 20 req/15min.
- Allocation: 10 req/min.
- **Weakness:** No per-user rate limiting. A botnet can hit 100 req/min from different IPs.

**Concurrency Handling:**
- **Race condition:** Two simultaneous `allocation` POSTs for the same user can both read the same `balance`, allocate, and save, causing double-spending.
- **Race condition:** `processReferral` does read-modify-write on referrer balance without locking.

**Real-Time Features:**
- Socket.IO with in-memory adapter. **Cannot scale horizontally** (multiple server instances won't share socket state).
- Must migrate to Redis Pub/Sub adapter for horizontal scaling.

**File & Media Storage:**
- No file uploads in the app. Not applicable.

**Infrastructure Ceiling:**
- Render free tier: 512MB RAM, sleeps after 15min idle.
- MongoDB Atlas M0: 512MB RAM, shared cluster.
- **Estimated capacity:** ~500 concurrent users before latency degradation. ~2,000 before crashes due to memory.

**Load Testing:**
- No load tests exist (k6, Artillery, Locust).

**Auto-Scaling:**
- No auto-scaling configuration. Render free tier does not auto-scale.

**SPOF / Bottlenecks:**
1. **Single Node process** for HTTP + Socket.IO.
2. **TwelveData WebSocket** — if it disconnects, no price updates, portfolio values freeze.
3. **MongoDB Atlas M0** — shared tier has noisy neighbor risk.

**Telegram-Specific Scale Risks:**
- `getChatMember` API called synchronously during task completion. At 30 req/sec bot limit, only 30 task completions/sec possible for channel-verified tasks.
- `answerPreCheckoutQuery` has a 10-second deadline. Under load, DB lookups may exceed this.

---

## Scalability Assessment Summary

**Estimated Concurrent User Capacity (current):** ~500 users
**Bottlenecks Before Failure:**
1. MongoDB M0 shared tier under heavy write load from `recalcAndBroadcastUser`.
2. Single Node process CPU-bound by Socket.IO broadcasts + Express HTTP.
3. Telegram Bot API rate limits on channel verification (30 req/sec).

**Scaling Effort to 10x Users:** **Medium**
- Requires Redis (caching + Socket.IO adapter).
- Requires MongoDB M10+ dedicated cluster.
- Requires splitting Socket.IO to separate service or using Redis adapter.
- Requires per-user rate limiting.
- Estimated effort: 2-3 weeks of engineering time.

---

## Telegram Mini App Specific Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| `window.Telegram.WebApp` initialized | ✅ | `useTelegram.ts` handles this |
| `ready()` called | ✅ | Called on mount |
| `expand()` called | ✅ | Called on mount |
| `MainButton` used | ❌ | Not implemented |
| `BackButton` used | ❌ | Not implemented |
| `HapticFeedback` used | ✅ | Used extensively |
| Viewport/theme handling | ⚠️ | Forced dark, ignores `themeParams` |
| `CloudStorage` used | ❌ | Uses `localStorage` instead |
| `openInvoice` used | ✅ | Correctly implemented |
| `openTelegramLink` used | ✅ | Used for sharing |
| `isClosingConfirmationEnabled` | ❌ | Not set |
| `viewport-stable-height` | ❌ | Not handled |
| HTTPS only | ⚠️ | Enforced by Telegram, but no HSTS |
| `initData` validation | ✅ | HMAC + auth_date verified |
| Bot deep linking (`startapp`) | ✅ | Referral system uses this |
| Responsive mobile design | ✅ | Mobile-first CSS |

---

## Pre-Release Action Plan

### Week 1: Critical Security & Stability
1. **Fix `lev_5x` pricing** — Change 1 Star to 500 Stars. (30 min)
2. **Add MongoDB transactions** — Wrap sell, allocation, and referral in sessions. (4 hours)
3. **Fix optimistic update rollback** — `setAssetLeverage` should revert on failure. (1 hour)
4. **Fix position history PnL** — Search backward for original allocation. (1 hour)
5. **Add per-user rate limiting** — Redis or in-memory by `telegramId`. (2 hours)
6. **Remove `images.unoptimized`** — Use `next/image`. (1 hour)
7. **Add CSRF protection** — SameSite strict + origin validation. (2 hours)

### Week 2: Production Hardening
8. **Add Sentry** — Frontend + backend error tracking. (2 hours)
9. **Implement JWT refresh tokens** — 24h access + 7d refresh. (4 hours)
10. **Add Redis caching** — Leaderboard + price snapshots. (4 hours)
11. **Add HTTPS enforcement** — HSTS + redirect. (30 min)
12. **Add admin dashboard** — Protected route with key metrics. (8 hours)
13. **Write tests** — At minimum, auth flow + allocation flow. (8 hours)

### Week 3: Telegram Compliance & UX
14. **Implement `MainButton`** — For "Confirm Allocation" and "Sell All". (3 hours)
15. **Implement `BackButton`** — For profile modal navigation. (2 hours)
16. **Migrate to `CloudStorage`** — Replace `localStorage`. (3 hours)
17. **Add skeleton screens** — For dashboard and leaderboard. (4 hours)
18. **Add i18n** — Extract strings, add Russian + Spanish. (8 hours)
19. **Add offline detection** — Banner when connection lost. (2 hours)

### Week 4: Growth & Analytics
20. **Add custom analytics** — Mixpanel/Amplitude for key events. (4 hours)
21. **Add bot commands** — `/start`, `/help`, `/leaderboard`. (2 hours)
22. **Add push re-engagement** — Bot DMs for tournament end, task reminders. (4 hours)
23. **Fix weekly reset fairness** — Reset balance to 100 or implement tournament wallet. (2 hours)
24. **Add PWA manifest** — For installability. (1 hour)

**Total Estimated Effort:** 4 weeks, 1 engineer.

---

## Post-Release Roadmap

### v1.1 (Month 2)
- **Multiple tournaments** — Daily + weekly leaderboards.
- **More assets** — Add ETH, SOL, indices.
- **Real TON prizes** — Integration with TON Connect for withdrawals.
- **Push notifications** — Tournament reminders via bot.
- **Improved caching** — Full Redis integration with cache invalidation.

### v1.2 (Month 3)
- **Social features** — Friend leaderboards, copy-trading.
- **Advanced orders** — Stop-loss, take-profit simulations.
- **Localization** — Full i18n with 10+ languages.
- **A/B testing** — Onboarding variants, pricing tests.
- **Performance** — Code splitting, image optimization, reduced motion.

### v2.0 (Month 4-5)
- **Horizontal scaling** — Microservices architecture, Kubernetes.
- **Real money mode** — Compliance, KYC integration.
- **NFT badges** — Achievement system on TON blockchain.
- **API platform** — Public API for third-party integrations.

---

*End of Report*
