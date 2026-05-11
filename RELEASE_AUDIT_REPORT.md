# Release Readiness Audit Report

**Generated:** May 11, 2026
**Overall Release Readiness Score:** 52/100

## Executive Summary

Holdex is a Telegram Mini App investment simulator with a cyberpunk neon UI. The app features real-time price feeds via TwelveData, a weekly tournament leaderboard with TON prizes, Telegram Stars monetization, and a referral system. While the core gameplay loop is functional and visually polished, the codebase has **significant security vulnerabilities**, **zero test coverage**, **no error boundaries**, **hardcoded secrets**, and **incomplete Telegram Mini App compliance** that must be addressed before production release. The backend architecture is solid with proper JWT auth, rate limiting, and MongoDB persistence, but the frontend has technical debt that could cause crashes and security incidents in production.

---

## 🔴 Critical Blockers (9 items)

| # | Issue | File/Location | Why Critical | Fix Required |
|---|-------|---------------|--------------|--------------|
| 1 | **Hardcoded API Key Exposed** | `test-websocket.js:4` | TwelveData API key `b23e7156a3c149c89e9f86b8c11df8b4` is committed to repo. Anyone can consume API quota or access paid data. | **[FIXED]** File removed from repo. **Action still required:** rotate the API key on TwelveData dashboard in case it was scraped before deletion. |
| 2 | **TypeScript Build Errors Suppressed** | `next.config.mjs:3-5` | `ignoreBuildErrors: true` hides type errors that could cause runtime crashes. | **[FIXED]** `ignoreBuildErrors` is already `false`. `setTourCompleted` is present in the `AppState` interface (`lib/store.ts:56`). |
| 3 | **CORS Allows Any Origin in Production** | `server/src/index.ts:44-60` | The `origin` callback falls back to `callback(null, true)` on line 55, allowing any domain to hit the API. Enables CSRF and unauthorized cross-origin requests. | **[FIXED]** Fallback changed to `callback(null, false)`. Wildcard `.vercel.app$` regex removed. Only `FRONTEND_URL` and `ALLOWED_ORIGINS` env var origins are permitted. |
| 4 | **No Root README.md** | Repository root | New developers and DevOps teams cannot understand the project structure, setup, or deployment without documentation. | Create comprehensive `README.md` with setup, architecture, and deployment instructions. |
| 5 | **No React Error Boundaries** | Entire frontend | Any unhandled exception in a component (e.g., `user.firstName.charAt(0)` in `header.tsx:58` if `firstName` is undefined) will crash the entire app shell. | **[FIXED]** Added `app/error.tsx` (catches page-level errors) and `app/global-error.tsx` (catches root layout errors). Also hardened `header.tsx`, `profile.tsx`, and `leaderboard.tsx` against `.charAt(0)` crashes with optional chaining. |
| 6 | **Mock Data Returned as Real Data** | `server/src/routes/allocation.ts:285-308` | When a user has no position history, the server returns fabricated mock trades (`mock-1`, `mock-2`) as if they were real. This is deceptive and violates trust. | **[FIXED]** Mock fallback removed. Returns `{ history: [] }` when no positions exist. |
| 7 | **No Telegram initData Expiration Check** | `server/src/services/auth.ts:3-41` | `validateTelegramInitData` verifies HMAC but never checks `auth_date` freshness. Old/stolen initData strings can be replayed indefinitely. | **[FIXED]** `auth_date` is validated after HMAC. initData older than 24 hours is rejected with `{ valid: false }`. |
| 8 | **Images Use Raw `<img>` Tags** | `components/navigation/header.tsx:55`, `components/pages/profile.tsx:107` | Bypasses Next.js image optimization, causes layout shift, no fallback handling, and potential HTTP mixed-content issues. | Replace with `next/image` or add proper `onError` fallbacks, width/height attributes. |
| 9 | **No Content Security Policy** | `app/layout.tsx:55` | External Telegram script loaded without `integrity`, `nonce`, or CSP headers. XSS risk if Telegram CDN is compromised. | Add CSP meta tag or helmet config; add `integrity` attribute to Telegram script. |

---

## 🟡 Important Issues (14 items)

| # | Issue | File/Location | Impact | Recommended Fix |
|---|-------|---------------|--------|-----------------|
| 1 | **Zero Test Coverage** | Entire project | No unit, integration, or E2E tests. Regressions will reach production undetected. | Add Vitest/Jest for unit tests, Supertest for API tests, and at least one E2E flow (e.g., auth → allocate → sell). |
| 2 | **No Error Tracking/Monitoring** | Entire project | Production crashes and API failures are invisible. No Sentry, LogRocket, or Datadog. | Integrate Sentry on frontend and backend. Add performance monitoring. |
| 3 | **Artificial Loading Delay** | `components/app-shell.tsx:37` | 2.5 second fake loading animation hurts perceived performance and frustrates users on fast connections. | **[FIXED]** Reduced to 600ms. Screen still dismisses immediately once auth completes; timer only controls the progress bar animation speed. |
| 4 | **No Internationalization** | All page components | 100% hardcoded English strings. Telegram has 700M+ non-English users. Blocks global growth. | Integrate `i18next` or `next-intl`. Extract all UI strings. Use Telegram's `language_code` as default. |
| 5 | **No Offline/Poor Connection Handling** | Frontend fetch calls | All `fetch` calls silently fail or show generic "Network error" with no retry. Users on poor mobile networks get stuck. | Add `fetch` wrapper with exponential backoff retry (3 attempts). Show offline state UI. |
| 6 | **Duplicate Global CSS** | `app/globals.css` and `styles/globals.css` | Two nearly identical CSS files create confusion. `app/globals.css` is imported; `styles/globals.css` appears unused but could conflict. | **[FIXED]** `styles/globals.css` deleted. `app/globals.css` is the single source of truth. |
| 7 | **No Rate Limit on Leaderboard** | `server/src/routes/leaderboard.ts:9` | `authMiddleware` is present but no dedicated rate limiter. High-traffic apps can spam expensive aggregation queries. | Add `generalLimiter` or a specific leaderboard rate limit (e.g., 30 req/min). |
| 8 | **No API Retry/Debounce on Sliders** | `components/allocation/allocation-slider.tsx:74-77` | Every slider micro-movement triggers `haptic.selection()` and state updates. Rapid dragging can cause performance issues. | Debounce slider `onValueChange` by 100-200ms. |
| 9 | **No Input Sanitization on Webhook** | `server/src/index.ts:69-181` | Telegram webhook parses `req.body` directly. While `zod` is used elsewhere, the webhook handler lacks schema validation for the entire Telegram `Update` object. | **[FIXED]** Added `WebhookBodySchema` (validates `update_id`, optional `pre_checkout_query`/`message.successful_payment`) and `PayloadSchema` (validates `packageId` + `telegramId`). Invalid payloads are logged and return `{ ok: true }` to Telegram without reaching business logic. |
| 10 | **Referral Link Uses Test Bot** | `components/pages/earn.tsx:34`, `components/pages/profile.tsx:32` | Hardcoded `https://t.me/holdextest_bot/holdex?startapp=...` must be updated to production bot before release. | Move bot username to env var `NEXT_PUBLIC_BOT_USERNAME`. |
| 11 | **Missing `setTourCompleted` in Interface** | `lib/store.ts` (interface block) | The store implementation defines `setTourCompleted` on line 134, but it is absent from the `AppState` interface (lines 18-90). TypeScript strict mode would catch this if enabled. | **[NOT AN ISSUE]** `setTourCompleted: () => void` is already present at `lib/store.ts:56`. |
| 12 | **No Graceful Shutdown for WebSocket** | `server/src/services/twelveData.ts` | On SIGTERM, the TwelveData WebSocket may not close cleanly, leaving dangling connections and potential memory leaks. | Call `stopTwelveData()` in the SIGTERM/SIGINT handlers in `index.ts`. |
| 13 | **Unused Toast System** | `hooks/use-toast.ts`, `components/ui/use-toast.ts` | Identical duplicate toast utilities exist but are never imported by any page component. Dead code adds bundle bloat. | **[FIXED]** Removed `hooks/use-toast.ts`, `components/ui/use-toast.ts`, `components/ui/toast.tsx`, `components/ui/toaster.tsx`, and `components/ui/sonner.tsx`. Verified zero imports across the entire codebase. |
| 14 | **No HTTPS/HSTS Enforcement** | `server/src/index.ts` | No redirect from HTTP to HTTPS, no HSTS header. Telegram Mini Apps require HTTPS. | Add helmet HSTS config and HTTP→HTTPS redirect middleware for production. |

---

## 🟢 Nice to Have (8 items)

| # | Issue | Recommended Fix |
|---|-------|-----------------|
| 1 | **No PWA/Service Worker** | Add a minimal service worker for offline asset caching and app installability. |
| 2 | **No CloudStorage Usage** | Use `Telegram.WebApp.CloudStorage` to persist user preferences (tour completion, last tab) across sessions without backend dependency. |
| 3 | **No Analytics Beyond Vercel** | Add Amplitude, Mixpanel, or Google Analytics 4 to track funnel conversion (auth → first allocation → store purchase). |
| 4 | **No Dark/Light Theme Toggle** | The app forces a cyberpunk dark theme. Respect `Telegram.WebApp.themeParams` for better native feel. |
| 5 | **No Custom 404/Error Pages** | Add `app/not-found.tsx` and `app/error.tsx` for better UX on navigation failures. |
| 6 | **Bundle Size: Framer Motion + Recharts** | Audit bundle with `@next/bundle-analyzer`. Consider lazy-loading `recharts` and `framer-motion` if not critical for first paint. |
| 7 | **No In-App Update Notification** | When deploying new versions, users may cache the old JS. Add a version check mechanism to prompt reload. |
| 8 | **No Accessibility (a11y) Audit** | Add `aria-label` attributes to icon buttons, ensure color contrast ratios meet WCAG 2.1 AA. |

---

## Detailed Findings by Category

### 1. 🏗️ Architecture & Code Quality

**Overall:** The architecture is a standard Next.js frontend + Express backend with Socket.IO. Separation of concerns is reasonable, but there are type safety gaps and dead code.

- **Component Structure:** Components are well-organized into `pages/`, `dashboard/`, `navigation/`, `ui/`, and `allocation/`. The `app-shell.tsx` acts as a layout controller.
- **Code Smells:**
  - `colorMap` object is duplicated across `asset-card.tsx`, `allocation-slider.tsx`, and `dashboard.tsx`. Extract to a shared helper.
  - `BACKEND_URL` is hardcoded/redeclared in every page component (`dashboard.tsx:12`, `allocate.tsx:14`, `earn.tsx:13`, etc.) instead of using a shared API client.
  - `assetIcons` map is duplicated in `asset-card.tsx:16-20` and `allocation-slider.tsx:16-20`.
  - `TWELVE_DATA_TO_ASSET` and `VOLATILITY_MULTIPLIER` logic is duplicated between frontend (`lib/store.ts:199`) and backend (`server/src/services/portfolio.ts:1-4`).
- **TypeScript Issues:**
  - `next.config.mjs:4` has `ignoreBuildErrors: false` — correct.
  - `lib/store.ts:162` uses `userData: any` in `setAuthenticatedUser`.
- **Dead Code (Fixed):**
  - `styles/globals.css` deleted.
  - `test-websocket.js` removed from repo.
  - Toast system (`hooks/use-toast.ts`, `components/ui/use-toast.ts`, `toast.tsx`, `toaster.tsx`, `sonner.tsx`) removed after verifying zero imports.

### 2. 🔐 Security

**Overall:** The backend has good security practices (JWT, rate limiting, Helmet), but the frontend and deployment configuration have serious gaps.

- **Exposed Secrets (Fixed):** `test-websocket.js` deleted from repo. **Action still required:** rotate the TwelveData API key in case it was scraped.
- **CORS Misconfiguration (Fixed):** `server/src/index.ts:55` no longer allows all origins. Fallback is `callback(null, false)`. Wildcard `.vercel.app$` regex removed.
- **initData Validation (Fixed):** `server/src/services/auth.ts` now checks `auth_date` freshness. initData older than 24 hours is rejected.
- **Input Validation (Fixed):** Telegram webhook (`index.ts:69`) now validates the full Telegram `Update` shape with Zod (`WebhookBodySchema`) and the invoice payload with `PayloadSchema`.
- **XSS Risk:** The Telegram WebApp script (`app/layout.tsx:55`) is loaded without `integrity` or CSP. User-generated content (e.g., `user.firstName`) is rendered directly in JSX, but React's default escaping provides baseline protection.
- **JWT Security:** Tokens expire in 30 days (`server/src/routes/auth.ts:87`). Consider shorter expiry with refresh tokens.
- **Rate Limiting:** `authLimiter` (20 per 15min), `allocationLimiter` (10 per min), and `generalLimiter` (100 per min) are well-configured. However, `/api/leaderboard` lacks a specific limiter.

### 3. ⚡ Performance

**Overall:** The app loads a heavy animation library (Framer Motion) globally and uses artificial delays. Real-world performance on 3G/mobile will suffer.

- **Bundle Size:** Dependencies include `framer-motion`, `recharts`, `lucide-react`, and 20+ Radix UI primitives. No bundle analyzer is configured.
- **Lazy Loading:** All pages are bundled into `AppShell` with no `React.lazy()` or `next/dynamic`. The entire app is a single chunk.
- **Re-renders:** `useAppStore` selectors are used well, but `lib/store.ts` has complex portfolio recalculation running on every price update. With 1000+ concurrent users and WebSocket price ticks, this could cause client-side jank.
- **Image Optimization:** `images.unoptimized: true` in `next.config.mjs:7` disables Next.js image optimization. Raw `<img>` tags are used for avatars.
- **API Efficiency:** No request deduplication, caching, or SWR usage. Dashboard and leaderboard fetch fresh data on every mount without stale-while-revalidate.
- **Telegram Launch Time (Fixed):** Artificial loading screen reduced from 2.5s to 600ms (`app-shell.tsx:37`). Screen still dismisses immediately once auth completes.

### 4. 📱 Telegram Mini App Compliance

**Overall:** Basic SDK integration is present, but the app misses several Telegram-specific UX patterns that users expect.

- **WebApp SDK:** `useTelegram.ts` correctly calls `expand()` and `ready()`. Haptic feedback is well-implemented across the app.
- **MainButton / BackButton:** **Not implemented.** The app uses its own bottom nav and buttons instead of native Telegram UI elements. This is a missed opportunity for native feel.
- **Theme Handling:** The app completely ignores `themeParams` and forces a cyberpunk dark theme. On light-mode Telegram, this feels foreign.
- **Viewport:** No usage of `viewportStableHeight`. The app uses fixed `pb-24` padding to avoid the bottom nav, which may break on devices with dynamic toolbars.
- **Safe Area:** CSS classes `safe-area-pt` and `safe-area-pb` exist in `header.tsx` and `bottom-nav.tsx`, but the actual CSS env vars (`env(safe-area-inset-*)`) are not defined in globals.css.
- **CloudStorage:** Not used. Tour completion and last active tab are stored in `localStorage`, which is less reliable in Mini Apps.
- **Payments:** `openInvoice` is implemented correctly with proper status handling (`store.tsx:66`). Webhook processing for Stars is solid.
- **Deep Linking:** Referral via `startapp` is implemented end-to-end (`REFERRAL_SETUP.md` documents this well).

### 5. 🎨 UI/UX Quality

**Overall:** Visually impressive with neon glassmorphism. Mobile-first layout is good, but some UX patterns need refinement.

- **Mobile-First:** Yes. Bottom nav, touch-friendly cards, and vertical scrolling are well-suited to mobile.
- **Touch Targets:** Bottom nav buttons are large enough. Slider thumbs and quick-percent buttons in `allocation-slider.tsx` meet 44px minimum.
- **Loading States:** `LoadingScreen` is visually rich but artificially delayed. Skeleton screens are absent.
- **Empty States:** `dashboard.tsx:267-273` shows a decent empty state for position history. However, `leaderboard.tsx:219-224` uses a trophy icon that lacks a call-to-action.
- **Error States:** `app-shell.tsx:194-207` shows a generic error screen with no retry button. `earn.tsx:107,116` uses `alert()` for errors — poor UX.
- **Accessibility:** No `aria-label` on icon buttons (`header.tsx:91`, `bottom-nav.tsx`). Color contrast for neon cyan on dark backgrounds may fail WCAG AA.

### 6. 🧪 Testing & Reliability

**Overall:** No tests exist. This is a major liability for production.

- **Test Coverage:** 0%. No test framework is installed.
- **Missing Critical Tests:**
  - Telegram initData HMAC validation with known good/bad signatures.
  - Portfolio PnL calculation edge cases (zero balance, negative values).
  - Allocation validation (sums > 100, negative values).
  - WebSocket reconnection behavior.
  - Stars payment webhook flow.
- **Error Boundaries (Fixed):** Added `app/error.tsx` and `app/global-error.tsx`. Also hardened `header.tsx`, `profile.tsx`, and `leaderboard.tsx` `.charAt(0)` calls with optional chaining.
- **Offline Handling:** None. The app assumes permanent connectivity.

### 7. 🌐 Localization & Internationalization

**Overall:** Completely absent. All strings are hardcoded English.

- **Hardcoded Strings:** Every component (`dashboard.tsx`, `earn.tsx`, `store.tsx`, `profile.tsx`, `leaderboard.tsx`) has hardcoded English UI text.
- **RTL Readiness:** No CSS logical properties or RTL-specific layout considerations.
- **Date/Number Formatting:** `toLocaleDateString('en-US')` is hardcoded in `dashboard.tsx:306`. Currency formatting uses `toLocaleString()` without specifying locale.
- **Telegram Language:** `user.language_code` from Telegram initData is parsed but never used to set app language.

### 8. 📊 Analytics & Monitoring

**Overall:** Minimal. Only Vercel Analytics is present.

- **User Behavior:** No funnel tracking, no event logging for "First Allocation", "Store Purchase", or "Referral Share".
- **Error Tracking:** No Sentry, Rollbar, or similar.
- **Performance Monitoring:** No Web Vitals reporting beyond Vercel's basic metrics.
- **Business Metrics:** No tracking of DAU, retention cohorts, or purchase conversion rates.

### 9. 🚀 Deployment & DevOps

**Overall:** Deployment docs exist and are good, but CI/CD is absent.

- **Environment Variables:** `.env.example` and `.env.production.example` exist. Server env vars are validated with Zod (`server/src/config/env.ts`).
- **Build Config:** `next.config.mjs` disables image optimization and ignores TS errors — both must be fixed.
- **CI/CD:** No GitHub Actions, no pre-merge checks, no automated tests.
- **Docker:** No Dockerfile or `docker-compose.yml`.
- **HTTPS:** Render and Vercel provide HTTPS by default, but the backend code does not enforce it.

### 10. 📈 Marketing & Growth Readiness

**Overall:** Good viral mechanics (referrals, tasks, sharing), but onboarding and retention need work.

- **Onboarding:** The 6-step tour (`onboarding-tour.tsx`) is well-designed but lacks A/B testing or analytics tracking.
- **Referral System:** Fully implemented with `startapp` deep links. Referrer gets 10 HLX + 2500 HLX for 5 invites.
- **Sharing:** `earn.tsx:61-68` uses `openTelegramLink` for sharing, which is correct.
- **Push Notifications:** No strategy for re-engagement via Telegram bot messages (e.g., "Tournament ends in 2 hours!").
- **Monetization:** Telegram Stars store is well-implemented with 7 SKUs. Pricing seems arbitrary (`lev_5x` costs 1 Star — likely a test price).
- **Retention:** No daily check-in, streaks, or push re-engagement mechanics beyond the weekly tournament.

### 11. 📋 Documentation

**Overall:** Good deployment docs exist, but developer onboarding is poor.

- **README:** Missing from root. `DEPLOY.md`, `REFERRAL_SETUP.md`, and `CHANNEL_VERIFICATION_SETUP.md` are good but scattered.
- **API Docs:** No OpenAPI/Swagger documentation for the Express backend.
- **Setup Instructions:** `DEPLOY.md` covers deployment but not local development setup for new engineers.

### 12. ⚠️ Critical Blockers vs Nice-to-Haves

(See consolidated lists at the top of this report.)

---

## Telegram Mini App Specific Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| `window.Telegram.WebApp` initialized | ✅ | `useTelegram.ts:26-37` |
| `ready()` called | ✅ | `useTelegram.ts:31` |
| `expand()` called | ✅ | `useTelegram.ts:30` |
| `HapticFeedback` used | ✅ | Used throughout UI interactions |
| `MainButton` used | ❌ | Not implemented |
| `BackButton` used | ❌ | Not implemented |
| `themeParams` respected | ❌ | App forces dark cyberpunk theme |
| `viewportStableHeight` used | ❌ | Not implemented |
| `CloudStorage` used | ❌ | Uses `localStorage` instead |
| `openInvoice` used | ✅ | `useTelegram.ts:70-101` |
| `openTelegramLink` used | ✅ | `earn.tsx:64` |
| Safe area insets handled | ⚠️ | CSS classes exist but env vars not defined |
| HTTPS required/enforced | ⚠️ | Relies on hosting provider |
| `initData` validated server-side | ✅ | HMAC validated; **`auth_date` freshness checked (24h)** |
| Deep linking (`startapp`) | ✅ | Fully implemented |

---

## Pre-Release Action Plan

### Week 1: Security & Stability (Priority: P0)

| Day | Task | Effort |
|-----|------|--------|
| 1 | ~~Rotate TwelveData API key; remove `test-websocket.js` from repo~~ | **DONE** (file removed; still rotate key) |
| 1 | ~~Fix CORS in `server/src/index.ts` to reject unknown origins~~ | **DONE** |
| 1 | ~~Add `auth_date` expiration check to `validateTelegramInitData`~~ | **DONE** |
| 2 | ~~Remove `ignoreBuildErrors` from `next.config.mjs`; fix TypeScript errors~~ | **DONE** |
| 2 | ~~Add `ErrorBoundary` to `app/page.tsx` wrapping `AppShell`~~ | **DONE** (`app/error.tsx` + `app/global-error.tsx`) |
| 3 | ~~Remove mock data fallback from `server/src/routes/allocation.ts`~~ | **DONE** |
| 3 | Replace raw `<img>` tags with `next/image` or add `onError` fallbacks | 2h |
| 4 | Add CSP meta tag in `app/layout.tsx` | 2h |
| 4 | Write root `README.md` | 3h |

### Week 2: Reliability & UX (Priority: P1)

| Day | Task | Effort |
|-----|------|--------|
| 5 | ~~Remove artificial 2.5s loading delay in `app-shell.tsx`~~ | **DONE** (reduced to 600ms) |
| 5 | Create shared API client with retry logic; remove duplicated `BACKEND_URL` | 4h |
| 6 | Add rate limiter to `/api/leaderboard` | 1h |
| 6 | ~~Add Zod validation to Telegram webhook handler~~ | **DONE** |
| 7 | Replace `alert()` calls in `earn.tsx` with in-app toast/snackbar | 2h |
| 7 | Add `aria-label` attributes to all icon-only buttons | 2h |
| 8 | ~~Add `not-found.tsx` and `error.tsx` to `app/`~~ | **DONE** (`app/error.tsx` + `app/global-error.tsx` added) |

### Week 3: Testing & Monitoring (Priority: P1)

| Day | Task | Effort |
|-----|------|--------|
| 9-10 | Add Vitest + React Testing Library; write tests for `store.ts`, `auth.ts`, portfolio calc | 8h |
| 11 | Add Supertest for Express API routes | 4h |
| 12 | Integrate Sentry frontend and backend SDKs | 3h |
| 12 | Add `@next/bundle-analyzer` and audit bundle | 2h |

### Week 4: Telegram Compliance & Polish (Priority: P2)

| Day | Task | Effort |
|-----|------|--------|
| 13 | Implement `viewportStableHeight` and safe area env vars | 3h |
| 14 | Add `MainButton` support for primary actions (Allocate, Sell) | 4h |
| 14 | Respect `themeParams` for background/text colors | 4h |
| 15 | Migrate tour completion from `localStorage` to `CloudStorage` | 2h |

---

## Post-Release Roadmap

### v1.1 (Immediate follow-up)
- **i18n:** Full English, Russian, Spanish, and Chinese localization.
- **PWA:** Service worker for offline caching and add-to-home-screen.
- **Analytics:** Amplitude/Mixpanel integration with funnel tracking.
- **A/B Testing:** Test different onboarding tour lengths and store pricing.

### v1.2 (Growth)
- **Push Notifications:** Bot-based re-engagement (daily price alerts, tournament reminders).
- **Social Proof:** Show "X users joined today" ticker in dashboard.
- **Streaks:** Daily login bonus mechanic to improve DAU.

### v1.3 (Monetization)
- **Subscription Tiers:** Premium monthly subscription via Telegram Stars for advanced analytics.
- **Ad Integration:** Optional rewarded video tasks (if Telegram allows).
- **TON Payout Automation:** Smart contract integration for automatic weekly prize distribution.

### v2.0 (Platform)
- **Real Trading:** Transition from simulation to micro-trading with real TON deposits.
- **Guilds/Teams:** Squad-based tournaments for viral group mechanics.
- **NFT Avatars:** Customizable profile NFTs purchasable with Stars.
