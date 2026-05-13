# Release Readiness Audit Report — Holdex

**Generated:** 2026-05-13
**Auditor:** Senior full-stack / product / growth review
**Scope:** Entire repository (frontend Next.js app + Express/MongoDB backend)
**Overall Release Readiness Score:** **44 / 100** — **NOT READY** for public release

> **Update (after merge of `main`):** Finding **C-1** (asset-leverage URL mismatch) was fixed in commit `e4c409d` / merge `beaa496` on `main` (frontend URL aligned to `/api/asset-leverage` in `lib/store.ts:482`, with a Vitest regression test at `server/src/__tests__/asset-leverage.test.ts`). C-1 below is marked **RESOLVED**. As a side effect, **I-1** (no tests) is now partially addressed — Vitest is wired into `server/` with one test. The remaining 11 critical blockers and the rest of the report are unchanged.

---

## Executive Summary

Holdex is a Telegram Mini App that lets users build a fantasy portfolio of three assets (BTC, Gold, EUR), apply asset-specific leverage, compete on a weekly TON-prize leaderboard, complete "earn" tasks for HLX tokens, and purchase HLX/leverage packages with Telegram Stars. The frontend is Next.js 16 + React 19 + Tailwind + shadcn/ui + Zustand + Framer Motion; the backend is Express + MongoDB (Mongoose) + Socket.IO + TwelveData WebSocket + node-cron, deployed on Render with the frontend on Vercel.

The core game loop is implemented and the heavy security work that *most* Mini App teams miss — Telegram `initData` HMAC validation, Stars webhook secret-token validation, pre-checkout price verification, and charge-ID deduplication — is **present and largely correct**. However, the app ships with **multiple monetization and economy-breaking bugs**, a **broken endpoint that silently fails in production**, an **unverifiable "Earn" rewards economy** that any logged-in user can drain, a **leaderboard rank query that returns rank=1 for nearly everyone**, and a number of scalability and operational gaps that will surface the moment the app gets real traffic. There are also no automated tests, no error tracking, no analytics, no localization, no README, and no CI pipeline.

This report enumerates every finding with file/line citations and prescribes a minimal pre-release action plan.

---

## 🔴 Critical Blockers (11 outstanding, 1 resolved)

These MUST be fixed before launching to a public audience. Each one either loses money, breaks a core feature, or exposes the platform to abuse.

### C-1. ~~Asset-Leverage API endpoint is wired to the wrong URL — silently 404s~~ **(RESOLVED in `beaa496`)**
- **Issue:** Frontend POSTs to `/api/allocation/asset-leverage`, but the backend route is `/api/asset-leverage`.
- **Files/Lines:**
  - Frontend: `lib/store.ts:482` — `fetch(\`${BACKEND_URL}/api/allocation/asset-leverage\`, ...)`
  - Backend route definition: `server/src/routes/allocation.ts:257-293` — `router.post('/asset-leverage', ...)`
  - Backend mount: `server/src/index.ts:309` — `app.use('/api', allocationRoutes)` → real path is `POST /api/asset-leverage`
- **Why critical:** Asset-specific leverage is a paid Stars feature on the Store screen. The optimistic UI sets local state but the backend never persists the change. After socket reconnect or a fresh login the user loses their leverage and there is no error toast (the catch is `.catch(err => console.error(err))`).
- **Fix required:** Change frontend URL to `/api/asset-leverage` OR change backend to `router.post('/allocation/asset-leverage', ...)`. Pick one and align both. Add an integration test.
- **Status:** Resolved on `main` — frontend was updated to `/api/asset-leverage` (`lib/store.ts:482`) and a Vitest regression test added at `server/src/__tests__/asset-leverage.test.ts`.

### C-2. "5x Leverage" Telegram Stars package is priced at 1 Star (~$0.02)
- **Issue:** `lev_5x` is priced at **1 Star** in both the frontend mock data and the backend Stars pricing table. Surrounding packages cost 250 and 1000 Stars.
- **Files/Lines:**
  - `lib/mock-data.ts:170` — `starsPrice: 1`
  - `server/src/routes/stars.ts:18` — `'lev_5x': { leverage: 5, starsPrice: 1 }`
- **Why critical:** This appears to be a debug value left in production. Because the backend price verification (`server/src/index.ts:188-195`) compares the invoice amount against `STARS_PACKAGES[packageId].starsPrice`, the server will happily credit a 5x leverage upgrade for **1 Star**. Direct revenue loss + economy distortion.
- **Fix required:** Set `lev_5x.starsPrice` to the intended value (e.g. 500 Stars) in **both** files. Audit every other package price for similar mistakes (no others detected, but verify before launch).

### C-3. "Earn" rewards are effectively free money — no verification on most tasks
- **Issue:** `POST /api/earn/complete` only verifies channel membership for tasks listed in `CHANNEL_VERIFICATION`. Today only `follow-telegram` is verified — and even that points to placeholder channel `@holdex_channel`. All other tasks (`follow-twitter`, `follow-instagram`, `watch-tutorial`, `watch-demo`, `visit-website`, `share-app`) immediately credit the reward when the client calls the endpoint.
- **Files/Lines:**
  - `server/src/routes/earn.ts:16-31` — task rewards and channel map
  - `server/src/routes/earn.ts:64-84` — only channel-verified tasks gate the reward
  - `components/pages/earn.tsx:89-120` — frontend opens link then auto-calls `/api/earn/complete` after a fixed `setTimeout(2000)` with no real verification
- **Why critical:** Total uncontested HLX rewards: 500 + 500 + 300 + 200 + 1000 + 500 + 300 = **3,300 HLX per account** for free, just by hitting one endpoint 7 times. Combined with `referredUsers` count for the invite task, a single user with a script can mint 33× their starting balance in seconds. This trashes the leaderboard fairness and undermines the Stars purchase value proposition for HLX packs.
- **Fix required:** Either (a) gate every social task behind a real provider check (Twitter/X API, Instagram graph, etc.), (b) require a moderation-reviewed proof, or (c) demote these to one-time micro-rewards and clearly mark them as honor-system. Update `@holdex_channel` to the real production channel and add admin verification that the bot is actually an administrator there.

### C-4. Leaderboard "userRank" query returns 1 for almost everyone
- **Issue:** Both the leaderboard endpoint and the frontend compute the current user's rank using **equality** matches that don't actually correspond to a shared rank cohort.
  - Backend: `User.countDocuments({ portfolioValue: { $gt: user.portfolioValue }, weekStart: user.weekStart })` (`server/src/routes/leaderboard.ts:22-26`). `weekStart` is stored as a per-user `Date` (`server/src/db/models/User.ts:67`) defaulted to creation time. Two users created at different milliseconds never share a `weekStart`, so the `$gt` count is almost always zero → `userRank = 1` for every new user.
  - Frontend: `components/pages/leaderboard.tsx:49` — `leaderboard.findIndex(e => e.user.id === user.id)`. Store sets `entries[i].user.id = String(telegramId)` (`lib/store.ts:413`) but `state.user.id` is the Mongo `_id` string (`server/src/routes/auth.ts:96`). The ids never match, so `userRank` is always `0` (i.e. `-1 + 1`), and the "below top 15" banner never renders.
- **Why critical:** The leaderboard is the headline competitive feature and the basis for TON prize distribution. A broken rank display erodes trust immediately. Worse, if a similar query pattern is ever copied to prize-distribution logic, the wrong rank could affect real payouts.
- **Fix required:**
  - Backend: compute rank with a single aggregation that windows on the **week boundary** (the same `getWeekBoundary()` already used in `services/leaderboard.ts`), not on a per-user `weekStart` field. Use `{ weekStart: { $gte: start, $lte: end } }`.
  - Frontend: match on `telegramId` (e.g. `e.user.id === String(user.telegramId)`) or align both ids to the Mongo `_id`. Then verify with an automated test that a user at rank 47 sees rank 47.

### C-5. Tournament reset cron and "cooldown" window overlap by ~24 hours
- **Issue:** `getTournamentPhase()` returns `'cooldown'` on Friday after 23:00 UTC, all of Saturday, and all of Sunday (allocations are disabled). The "weekly reset" cron runs at **Sunday 00:00 UTC**, which zeros every user's allocations, portfolioValue and `weekStart`. From Sunday 00:00 until Monday 00:00 the app is in cooldown **after** users have already been wiped.
- **Files/Lines:**
  - `server/src/services/leaderboard.ts:201-232` — cron schedules `'59 23 * * 5'` (archive) and `'0 0 * * 0'` (reset)
  - Phase logic is referenced from `getTournamentPhase` (also in `leaderboard.ts`) — Saturday+Sunday and Friday>=23:00 all count as cooldown
- **Why critical:** Users who held positions Friday evening see them archived correctly, but then on Sunday morning their portfolio is reset to 100 HLX even though the UI says "tournament starts next week" — and they can't allocate until Monday. This is confusing, looks like a data-loss bug, and will generate Telegram support volume.
- **Fix required:** Either delay the reset cron to Monday 00:00 UTC (`'0 0 * * 1'`) so it aligns with the end of cooldown, or shorten cooldown to end Sunday 00:00. Then update copy in `components/pages/dashboard.tsx` and `components/dashboard/prize-pool-card.tsx` to reflect the chosen window.

### C-6. Production code points to the **test** Telegram bot
- **Issue:** The referral / share deep link is hard-coded to `holdextest_bot`.
- **Files/Lines:**
  - `components/pages/earn.tsx:34` — `\`https://t.me/holdextest_bot/holdex?startapp=${user.telegramId}\``
  - `components/pages/profile.tsx:33` — same string
- **Why critical:** If you launch to production the share links route every invited user to the test bot, which may or may not be running, and the referral attribution (`parseStartParam` → `processReferral`) will silently fail on the production bot.
- **Fix required:** Move the bot username to `NEXT_PUBLIC_BOT_USERNAME` (or fetch it from `webApp.initDataUnsafe`/backend) and set the prod value in `.env.production`. Add a build-time sanity check.

### C-7. In-memory dedupe + replay protection is lost on every server restart
- **Issue:** Telegram webhook deduplication relies on two in-memory `Set`s.
  - `server/src/index.ts:94-103` — `processedUpdateIds`, `processedChargeIds`
- **Why critical:** Render restarts on every redeploy (and on free-tier idle wake-ups). After a restart, Telegram will happily retry recent webhooks for `pre_checkout_query` and `successful_payment`. With dedupe wiped, a successful payment update can be processed **twice** — crediting the same user twice for the same charge ID. Real money has been spent; double-credit is a real exploit window.
- **Fix required:** Persist processed `telegram_payment_charge_id`s in MongoDB (a tiny `ProcessedCharge` collection with a unique index) and check it before crediting. Alternatively use Redis with a 7-day TTL. Same for `update_id` if you still want defence-in-depth.

### C-8. MongoDB transactions will fail outside a replica set
- **Issue:** `routes/allocation.ts:59-89` and `:188-234` use `user.db.startSession()` / `session.withTransaction()`. `services/referral.ts` does the same.
- **Why critical:** Mongoose transactions require a **replica set or sharded cluster**. A single-node `mongod` (the default local install and many cheap providers) throws `Transaction numbers are only allowed on a replica set member or mongos`. Atlas free tier is fine, but the moment you swap providers or run integration tests locally the allocation/sell flows 500. There's no test catching this.
- **Fix required:** Document the requirement explicitly in the README, fail fast at boot (check `db.admin().replSetGetStatus()`), and either (a) require Atlas or (b) fall back to non-transactional writes with idempotency keys when a replica set isn't available.

### C-9. CSP allows `'unsafe-inline'` for both scripts and styles
- **Issue:** `next.config.mjs:28` — the Content-Security-Policy header contains `script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`.
- **Why critical:** `unsafe-inline` for scripts negates most of CSP's XSS protection. Telegram Mini Apps run inside a WebView that is one HTML injection away from full account control because there is no Same-Origin separation against the Telegram client itself.
- **Fix required:** Remove `'unsafe-inline'` from `script-src`. Next.js can support nonces or hashes via `headers()` plus a custom `_document` shim. For Tailwind/shadcn inline styles, prefer hashes or move to CSS modules; if you absolutely must keep inline styles, narrow it to `style-src 'self' 'unsafe-inline'` only, never scripts.

### C-10. `telegram-web-app.js` is vendored locally instead of loaded from `telegram.org`
- **Issue:** `public/telegram-web-app.js` is a 116 KB vendored copy. `app/layout.tsx` should load `<script src="https://telegram.org/js/telegram-web-app.js"></script>` per the Telegram docs.
- **Why critical:** Telegram regularly ships SDK fixes (haptics, cloud storage, fullscreen, bio-auth). A pinned local copy means users see stale behaviour, and any new method (e.g. `requestFullscreen`, `disableVerticalSwipes`, `enableClosingConfirmation`) is missing or buggy. It also bloats the JS payload.
- **Fix required:** Use the official CDN URL with `async` and remove the vendored file. Keep a fallback only if you have a documented need.

### C-11. No README / no setup instructions / no environment guide
- **Issue:** There is no `README.md` at the project root. There is no CONTRIBUTING, no architecture diagram, no run instructions, no notes on the Render + Vercel + MongoDB Atlas split, and the only documentation is a Persian-language Socket.IO rate-limit README at `server/src/middleware/SOCKET_RATE_LIMIT_README.md`.
- **Files/Lines:** `git ls-files` confirms `README.md` is not tracked.
- **Why critical:** New engineers cannot onboard. Production incidents will not have a "how to start the server" runbook. Telegram Apps Center / BotFather submissions usually want a description and screenshots — there is no source of truth.
- **Fix required:** Add a top-level `README.md` covering: project overview, stack, local dev (frontend + backend + Mongo + ngrok for webhooks), environment variables (cross-reference both `.env.example` files), Telegram BotFather setup, Render + Vercel deployment, and a "first 5 minutes" smoke test.

### C-12. No error tracking, no analytics, no monitoring
- **Issue:** No Sentry, no Datadog, no PostHog, no Vercel Analytics on the backend, no health-check pings. The frontend imports `@vercel/analytics/next` (`app/layout.tsx:91`) but only that — no error capture, no event tracking, no funnel.
- **Why critical:** When (not if) something breaks in production you will not know until users complain in Telegram. There is no error grouping, no release tagging, no source-map upload, and no business KPI dashboard for purchases / DAU / retention.
- **Fix required:** Add Sentry to both frontend and backend (free tier is sufficient for launch). Add PostHog or Mixpanel for product analytics with at least: `auth_success`, `allocation_submitted`, `sell_all`, `stars_purchase_started`, `stars_purchase_paid`, `task_completed`, `tab_changed`. Set up an uptime monitor (BetterStack, UptimeRobot) on `/health` and `getWebhookInfo()`.

---

## 🟡 Important Issues (24 items)

These should be fixed before launch but are not, individually, ship-stopping. Most affect reliability, performance, scalability or growth.

### I-1. No automated tests anywhere in the repo
- **Files/Lines:** No `*.test.*`, `*.spec.*`, `jest.config*`, `vitest.config*`, `playwright*`, or `__tests__` directories anywhere in the tree.
- **Impact:** Every change is shipped on hope. The Stars webhook (the highest-value code path) has zero coverage.
- **Recommended fix:** Add Vitest for the server (target ≥ 50% on `services/auth.ts`, `services/portfolio.ts`, `services/referral.ts`, and the Stars webhook handler in `index.ts`). Add Playwright for at least the auth → allocate → sell → leaderboard happy path.

### I-2. `/api/allocation/sell` is not rate-limited
- **Files/Lines:** `server/src/routes/allocation.ts:132` — only `authMiddleware`, no `allocationLimiter`.
- **Impact:** A user can hammer "sell" to spam transactions, generate `Position` rows, and create churn-like load. Allocations are limited to 10/min but sells are unlimited.
- **Recommended fix:** Apply `allocationLimiter` (or a dedicated `sellLimiter`) here. Same for `/api/asset-leverage`.

### I-3. `/health` does not check MongoDB or Socket.IO
- **Files/Lines:** `server/src/index.ts:64-66`.
- **Impact:** Render's health probe will keep the container alive even if Mongo is disconnected and every request is 500. The endpoint should verify `mongoose.connection.readyState === 1` and `getIo()` returns a server.
- **Recommended fix:** Return 503 when downstreams are unhealthy; keep `uptime` for diagnostics.

### I-4. No graceful shutdown
- **Files/Lines:** `server/src/index.ts` (no `SIGTERM`/`SIGINT` handlers visible).
- **Impact:** Render sends SIGTERM and kills the process after 30s. In-flight `withTransaction` calls, Socket.IO clients, the TwelveData WebSocket, and the leaderboard cron are all torn down abruptly. Result: orphaned positions, half-applied allocations, and noisy reconnects.
- **Recommended fix:** Listen to SIGTERM, `await new Promise(r => httpServer.close(r))`, `await io.close()`, close TwelveData WS, `await mongoose.disconnect()`.

### I-5. No Redis — rate limits, dedupe and pub/sub all live in single-process memory
- **Files/Lines:**
  - `server/src/middleware/rateLimit.ts:1-22` — `express-rate-limit` defaults to in-memory store
  - `server/src/middleware/socketRateLimit.ts:6-21` — `RateLimiterMemory`
  - `server/src/index.ts:94-103` — webhook dedupe sets
  - `server/src/services/socket.ts` — Socket.IO not configured with a `redis-adapter`
- **Impact:** The moment you scale to 2 instances, rate limits become per-instance (so attackers get 2× the budget), and Socket.IO broadcasts only reach clients on the same instance. The webhook dedupe (see C-7) is also lost.
- **Recommended fix:** Add Upstash Redis (free tier). Wire `express-rate-limit` + `RateLimiterRedis` + `@socket.io/redis-adapter`. Move webhook dedupe to Redis with `SETEX charge:<id> 7d 1`.

### I-6. TwelveData fallback prices are baked into source as plausible-looking values
- **Files/Lines:** `server/src/services/twelveData.ts:14-18` — `BTC/USD: 67234.50`, `XAU/USD: 2341.80`, `EUR/USD: 1.17`.
- **Impact:** On TwelveData reconnect (which happens), these stale prices are broadcast as "current". Until the next real tick arrives, `Position` rows are created with wrong `priceAtTime` and PnL is calculated against a fictitious initial price.
- **Recommended fix:** Either (a) refuse allocations until at least one real tick has been received for the asset (block on `lastTickTimestamp[asset] < 60s ago`), or (b) replace fallback values with `null` and explicitly handle the "no price yet" state in `getLatestPrices` consumers.

### I-7. Portfolio multipliers + leverage can hit -100% in a single tick
- **Files/Lines:**
  - `server/src/services/portfolio.ts` — `VOLATILITY_MULTIPLIER: { BTC: 100, GOLD: 50, EUR: 1000 }`
  - Same constants duplicated client-side at `lib/store.ts:368`
- **Impact:** EUR at 1000× amplification means a 0.1% real EUR move = 100% gain or loss before leverage. With 10× leverage, a 0.01% move wipes the position. This is the *intended* game mechanic but: (a) the constants are duplicated in two places (frontend and backend) and will drift, (b) there is no `Math.max(-1, leveragedChange)` cap so a single bad tick deletes the entire portfolio with no UX explanation. The transaction log shows just "sold for 0".
- **Recommended fix:** Centralise multipliers in a shared `lib/constants/portfolio.ts` (or fetch them from the server). Cap the per-tick drawdown at -100% explicitly. Add an in-app explanation of the multipliers ("Each asset has a volatility booster") so users understand the loss curve.

### I-8. Leaderboard endpoint fetches up to 500 full user docs every poll
- **Files/Lines:** `server/src/services/leaderboard.ts:101-150`, `server/src/routes/leaderboard.ts:11-14`.
- **Impact:** With 1k+ users and clients polling on tab focus + websocket reconnect, this is the most expensive query in the app. There is no caching layer.
- **Recommended fix:** Cache the top-N response in Redis with a 5-10s TTL (acceptable lag for a fantasy leaderboard) and key by week boundary. Add MongoDB index `{ weekStart: 1, totalPnlPercent: -1 }` (already partly present at `User.ts:74`) and use a `.lean()` aggregation that projects only the displayed fields.

### I-9. No pagination on leaderboard — always returns 500
- **Files/Lines:** `server/src/routes/leaderboard.ts:11` — `limit = parseInt(req.query.limit || '500')`.
- **Impact:** Mobile clients receive ~500 entries × ~250 bytes JSON per refresh. On 3G this is noticeable. Worse, the frontend renders all 500 in a single virtualised list (it isn't virtualised — see `components/pages/leaderboard.tsx`), so DOM nodes pile up.
- **Recommended fix:** Default `limit=50`, support `cursor` pagination, and use a `react-virtuoso` or `@tanstack/react-virtual` list.

### I-10. Auth tokens last 30 days with no rotation, no refresh, no revocation
- **Files/Lines:** `server/src/routes/auth.ts:87-91` — `expiresIn: '30d'`.
- **Impact:** If a token leaks (logged on a shared device, captured in a screen recording), there's no way to invalidate it short of rotating `JWT_SECRET` (which logs everyone out). No `jti`, no allow-list.
- **Recommended fix:** Drop expiry to 7 days with silent refresh on each auth call (it already happens via `POST /api/auth`). Add a `jti` and a Redis allow-list if you need true revocation.

### I-11. Socket.IO trusts any `socket.handshake.address` for IP-based rate limiting
- **Files/Lines:** `server/src/middleware/socketRateLimit.ts:31`.
- **Impact:** Behind Render's proxy, `socket.handshake.address` is the proxy IP unless `trust proxy` is set. Express sets `app.set('trust proxy', 1)` — but Socket.IO is configured separately. Without `Engine.IO` trust-proxy, all sockets share the same IP and a single user can DoS the whole pool. Worse, attackers can spoof `X-Forwarded-For` if you blindly trust it.
- **Recommended fix:** Use `socket.handshake.headers['x-forwarded-for']?.split(',')[0]` (when behind a known proxy) or pass the IP from a verified Express middleware. Pin Render's edge proxy as the only trusted hop.

### I-12. CORS whitelist does not include `*.vercel.app` preview deployments
- **Files/Lines:** `server/src/index.ts:34-43`.
- **Impact:** Vercel branch/preview URLs (e.g. `holdex-git-feature-x.vercel.app`) are blocked. Developers can't test against staging without a manual `ALLOWED_ORIGINS` update for each branch.
- **Recommended fix:** Add a regex whitelist for `^https://holdex(-[a-z0-9-]+)?\.vercel\.app$` and reject everything else. Document in the README that only the production domain is hard-allowed.

### I-13. `helmet()` is on, but X-Frame-Options is left at default DENY — fine for browsers, but Telegram WebView is iframed
- **Files/Lines:** `server/src/index.ts:31` — `app.use(helmet())` with no customisation; `next.config.mjs:23-32` — frontend `frame-ancestors 'none'`.
- **Impact:** Backend endpoints are not iframed so this is fine for the API, but the frontend's `frame-ancestors 'none'` means if Telegram ever opens the Mini App inside a wrapper iframe (some Android wrappers do), it will be blocked. Test on real Telegram Android + iOS clients.
- **Recommended fix:** Verify the Mini App loads on iOS, Android, and Desktop Telegram clients. If iframe rendering breaks, change CSP `frame-ancestors` to `'self' https://*.telegram.org` (or `*` if you don't care, since the JS bridge is the actual surface).

### I-14. No internationalization — every user-facing string is hard-coded English
- **Files/Lines:** Every `.tsx` file. Examples: `components/pages/earn.tsx:133` "Earn Free HLX", `components/pages/leaderboard.tsx:114` "Weekly tournament", `components/pages/store.tsx`, etc.
- **Impact:** Telegram's user base is heavily non-English (Russian, Spanish, Portuguese, Indonesian, Persian). The internal Persian comments in `socketRateLimit.ts` suggest the team is multilingual — capitalise on that.
- **Recommended fix:** Add `next-intl` with at least `en` and `ru` to start. Read `webApp.initDataUnsafe.user.language_code` and auto-select. Externalise all strings.

### I-15. No skeleton screens — most pages flash blank on first render
- **Files/Lines:** `components/pages/dashboard.tsx`, `components/pages/leaderboard.tsx:90-101` (the leaderboard does have a spinner, but content cards do not).
- **Impact:** Telegram Mini Apps are judged in the first 2 seconds. A flash of empty layout before data arrives looks broken.
- **Recommended fix:** Use shadcn's `Skeleton` component (already in `components/ui/skeleton.tsx`) inside `Suspense` boundaries for dashboard cards, leaderboard rows, and history list.

### I-16. Telegram BackButton is never wired up
- **Files/Lines:** `hooks/use-telegram.ts` exposes `webApp` but no helper for `BackButton.show()` / `onClick`. Profile sheet (`components/pages/profile.tsx`) is a full-screen overlay with only a custom X button.
- **Impact:** On Telegram Android, the system back gesture closes the entire Mini App when an overlay is open. Users expect "back" to close the overlay first.
- **Recommended fix:** In `Profile` open, call `webApp.BackButton.show()` and bind `onClick` to `onClose`. Hide it on unmount. Same pattern for the onboarding tour modal.

### I-17. Onboarding tour is non-skippable on subsequent loads — only stored in `localStorage`
- **Files/Lines:** `components/onboarding-tour.tsx` (gated by `localStorage` flag in `app-shell.tsx`).
- **Impact:** `localStorage` survives across launches but is wiped if the user reinstalls Telegram or switches devices. Returning users see the tour again.
- **Recommended fix:** Persist `onboarding_completed` server-side on the `User` model and check it on auth.

### I-18. Frontend mutates user state optimistically on Stars purchase **before** webhook confirms
- **Files/Lines:** `components/pages/store.tsx:70-87` — when `openInvoice` returns `'paid'`, the client locally adds HLX / leverage. The actual server credit happens via the webhook in `server/src/index.ts:230-285`.
- **Impact:** If the webhook fails (Telegram retries up to 24h), the user sees credited HLX in the UI that disappears on next auth/login. Or, worse, both the optimistic client write and the webhook succeed and double-credit until refresh. Currently the server is authoritative on auth response, so it will eventually reconcile, but the in-between window is confusing.
- **Recommended fix:** Don't optimistically credit. Show a "Payment received — crediting…" state, poll a `/api/user/me` endpoint until the balance matches, then show success. This is the same pattern Stars examples use.

### I-19. Webhook handler trusts `invoice_payload` JSON without try/catch around `JSON.parse`
- **Files/Lines:** `server/src/index.ts` — `JSON.parse(payload)` call inside the webhook handler.
- **Impact:** A malformed payload (which the Zod schema only checks is a string) crashes the handler. Telegram retries it. Eventually it returns 200 to stop the retry storm, but each crash is a log-spam + 500.
- **Recommended fix:** Wrap `JSON.parse` in `try/catch`, log + 200 on failure (so Telegram stops retrying), or define the payload as `z.string().refine(jsonParseable)`.

### I-20. `.env.example` files are tracked but real `.env` is correctly ignored
- **Files/Lines:** `git ls-files` shows only `.env.example` / `.env.production.example`; `.gitignore` correctly excludes `.env` etc.
- **Impact:** Good. But the `.env.example` for the **frontend** is missing entirely at the repo root (`grep -l NEXT_PUBLIC_BACKEND_URL` returns only `package.json` and `.env.production.example`). New devs can't find what env vars the frontend needs.
- **Recommended fix:** Add a root `.env.example` listing `NEXT_PUBLIC_BACKEND_URL` and any other public env vars.

### I-21. Position history endpoint is hard-capped at 50 records with no pagination
- **Files/Lines:** `server/src/routes/allocation.ts:310-314` — `.limit(50)`.
- **Impact:** Power users will accumulate >50 positions in a week (allocate + sell pairs). They see only the most recent half, with no way to scroll back.
- **Recommended fix:** Add `?before=<createdAt>` cursor pagination. Frontend already has scaffolding to render an arbitrary list.

### I-22. Logs are written to local `logs/error.log` and `logs/combined.log`
- **Files/Lines:** `server/src/utils/logger.ts:18-20`.
- **Impact:** On Render's ephemeral filesystem these logs are lost on every restart. They also consume container disk during long runs and can crash the dyno when full. Production logs should ship to stdout only.
- **Recommended fix:** Drop the file transports in production (`if (env.NODE_ENV !== 'production')`), rely on Render's stdout capture, and ship to a log aggregator (Logtail, Better Stack, Datadog).

### I-23. No HTTPS enforcement in code; relies entirely on Render/Vercel
- **Files/Lines:** No `helmet.hsts` config override; no redirect middleware.
- **Impact:** Telegram Mini Apps **require** HTTPS for the Mini App URL. Render and Vercel handle this, but if you ever serve from a custom domain or another host you can silently downgrade.
- **Recommended fix:** Add `helmet.hsts({ maxAge: 15552000, includeSubDomains: true })` and a `req.headers['x-forwarded-proto'] !== 'https'` redirect (in production only).

### I-24. ESLint is missing — there is no `.eslintrc` / `eslint.config.*` / `next.config` `eslint:`
- **Files/Lines:** `ls -la` shows no eslint config; `package.json` has no `lint` script (frontend) — only `dev`/`build`/`start`.
- **Impact:** Easy lint regressions slip in (unused imports, `any` casts, missing keys). Backend `package.json` has lint but I couldn't find an actual config either.
- **Recommended fix:** Run `npx next lint --strict` once to scaffold, commit `.eslintrc.json`, add `npm run lint` script, and gate CI on it.

---

## 🟢 Nice to Have (15 items)

Quality-of-life improvements that won't block launch.

1. **G-1.** Remove `userScalable: false` from `app/layout.tsx:43` to allow pinch-zoom for accessibility, or document an accessibility decision to keep it locked.
2. **G-2.** Replace 7 inline copies of `const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'` with a single export from `lib/config.ts`.
3. **G-3.** Replace the duplicated `multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }` literal that appears in at least three places (`server/src/routes/allocation.ts:71,152`, `lib/store.ts:368`, `server/src/services/portfolio.ts`).
4. **G-4.** Drop `pnpm-lock.yaml` **or** `package-lock.json` — having both at the root invites version drift.
5. **G-5.** Move `STARS_PACKAGES` to a single source of truth file imported by both `server/src/routes/stars.ts` and `lib/mock-data.ts` (currently they are two hand-maintained tables that must stay in sync).
6. **G-6.** Persian-language `server/src/middleware/SOCKET_RATE_LIMIT_README.md` should be translated to English or moved to a `docs/` folder and tagged `lang: fa`.
7. **G-7.** `lib/mock-data.ts:51-122` ships ~70 lines of fake leaderboard names ("cryptoking", "moonshot") into the production bundle. Remove or tree-shake under `NODE_ENV !== 'production'`.
8. **G-8.** `next-env.d.ts` is tracked (Next will regenerate it); fine but generates noisy diffs.
9. **G-9.** `tsconfig.tsbuildinfo` is **not** in repo (good), but ensure `.gitignore` keeps it that way as the team grows.
10. **G-10.** Add `<meta name="theme-color" media="(prefers-color-scheme: light)" content="..."/>` variants alongside the existing dark `#1a1625` for Telegram light mode.
11. **G-11.** Add a `manifest.json` for PWA install (some users use Telegram Web on desktop and may want to bookmark).
12. **G-12.** Move shadcn `components/ui/*.tsx` into a dedicated `components/ui/` barrel-export and tree-shake unused (the `components/ui/` folder has 60+ components; many are unused).
13. **G-13.** Add Storybook for design-system components (`GlassCard`, `NeonText`, `AllocationSlider`).
14. **G-14.** Replace the bespoke `framer-motion` page transitions in `app-shell.tsx` with Next.js View Transitions API once it stabilises (already shipping in Next 16 canary).
15. **G-15.** Add `@vercel/og` for share images so referral links preview nicely in Telegram link previews.

---

## Detailed Findings by Category

### 1. 🏗️ Architecture & Code Quality

**Overall:** Reasonable mono-repo split between the Next.js app (root) and the Express server (`server/`). Both use TypeScript with strict mode. Component structure follows shadcn conventions cleanly. Zustand store is used for global frontend state and a Socket.IO client is integrated through `hooks/use-socket.ts`.

**Strengths**
- Clear separation of concerns: routes → services → models on the backend, pages → hooks → store on the frontend.
- Zod is used for both request validation (`server/src/middleware/validate.ts`) and env-var parsing (`server/src/config/env.ts`).
- MongoDB indexes are defined on every relevant field (`User.ts:72-74`, `Position.ts:31`, `Leaderboard.ts:35-36`).
- Mongoose transactions wrap critical multi-write operations (allocation, sell, referral).
- Socket.IO connections are gated by JWT authentication and rate-limited.

**Issues**
- **Duplicate constants:** Portfolio multipliers, `BACKEND_URL`, `STARS_PACKAGES`, and the multiplier table for asset PnL are duplicated between client and server. Risk of silent drift. (See G-2, G-3, G-5.)
- **`any` types in hot paths:** `server/src/routes/allocation.ts:323` (`const entry: any = ...`), `server/src/services/telegram.ts:186` (`as any`), several `e: any` catches. Replace with proper Zod-inferred types.
- **Mixed Persian/English code comments:** `server/src/middleware/socketRateLimit.ts` is bilingual. Translate consistently.
- **Dead code:** `server/src/middleware/socketRateLimit.example.ts` is shipped to production. Move to `docs/`.
- **Mock data in production bundle:** `lib/mock-data.ts:51-122` ships fake leaderboard entries.
- **Comments out of sync with code:** `server/src/routes/stars.ts:79-82` references a "deprecated webhook endpoint" that no longer exists in this file — the comment is stale.
- **Misplaced `multipliers` constant inside route handler** (`allocation.ts:71`, `:152`) — should be a module-level constant.

### 2. 🔐 Security

**Strengths**
- **Telegram `initData` validation is correctly implemented** in `server/src/services/auth.ts:1-47`: HMAC-SHA256 against `WebAppData` key, sorted data-check string, 24h freshness window. This is the single most important security control in any Mini App.
- **Stars webhook validates the secret token** via `X-Telegram-Bot-Api-Secret-Token` (`server/src/index.ts:105-110`).
- **Pre-checkout price verification** against the server's authoritative `STARS_PACKAGES` table (`index.ts:188-195`) — clients can't tamper with the amount.
- **JWT secret enforced ≥32 chars** via Zod (`server/src/config/env.ts`).
- **Rate limiters** at HTTP (`rateLimit.ts`) and Socket (`socketRateLimit.ts`) layers.
- **CORS whitelist** instead of `*`.
- **`express.json({ limit: '10kb' })`** prevents body bombs.
- **`.env` files are gitignored** and only `.env.example` variants are tracked.

**Issues**
- **C-2, C-3, C-7** above are security/economic issues, not just feature bugs.
- **C-9:** CSP `unsafe-inline` for scripts.
- **I-5:** In-memory rate limits = bypassable with horizontal scale.
- **I-11:** Socket IP detection trusts arbitrary handshake address.
- **I-22:** Logs to ephemeral disk.
- **I-23:** No HSTS enforcement in code.
- **No CSRF protection** — acceptable because the API uses Bearer JWT in headers (not cookies), but document this decision.
- **No request signing** between frontend and backend — anyone with a stolen JWT has 30 days of unrestricted access.
- **`processReferral` is a write path triggered by the unverified `start_param`** — the validation in `services/referral.ts:11-101` is correct (self-ref check, duplicate check, transaction), but ensure `parseStartParam` rejects non-numeric strings (currently it does via `parseInt + isNaN`, good).
- **No password rotation procedure documented for `MONGODB_URI`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TWELVE_DATA_API_KEY`.**
- **No npm audit / no Dependabot / no Snyk** in CI.

### 3. ⚡ Performance

**Bundle**
- Next.js 16 + React 19 + Framer Motion + shadcn/ui (60+ components, many likely unused) + Lucide-react. The 116 KB vendored `telegram-web-app.js` (C-10) adds noticeable weight.
- No bundle analysis script (`next-bundle-analyzer`) configured.

**Rendering**
- Liberal use of Framer Motion `motion.*` wrappers in lists (`bottom-nav.tsx`, `earn.tsx`, `leaderboard.tsx`, `store.tsx`). On low-end Android this can cause jank — measure on a real device.
- The leaderboard renders all entries (up to 500) without virtualisation (`components/pages/leaderboard.tsx`).
- `useEffect`-driven `fetch` in three places on the dashboard (`dashboard.tsx:30-71`) — leaderboard + position history. No SWR/React Query caching, no deduplication; each tab change refetches.

**Network**
- Socket.IO emits price updates every TwelveData tick (typically every few seconds). Each client receives `price_update` for every symbol regardless of allocation. Consider per-client subscription filtering.
- `/api/leaderboard?limit=500` polled on every Leaderboard tab open with no client cache.

**Recommendations**
- Add React Query (`@tanstack/react-query`) for all `fetch` calls. Cache leaderboard for 10s, position-history for 30s.
- Virtualise the leaderboard list with `@tanstack/react-virtual`.
- Subscribe to a Socket.IO room per asset; only emit updates to clients in the room.
- Run `next build` with `ANALYZE=true` and trim unused shadcn primitives.

### 4. 📱 Telegram Mini App Compliance

**Implemented well**
- `webApp.ready()` is called in `hooks/use-telegram.ts`.
- `webApp.expand()` is called.
- HapticFeedback is used throughout (selection, impact, notification).
- `themeParams.bg_color` is wired into CSS variables (`hooks/use-telegram.ts` and `app/globals.css`).
- `openInvoice` is used for Stars purchases.
- `webApp.openLink` / `openTelegramLink` are used for external URLs.
- Viewport meta is mobile-locked (`app/layout.tsx:39-45`).
- Safe-area helpers (`safe-area-pt`, `safe-area-pb`) are used in header/bottom-nav.

**Missing / incorrect**
- **C-6:** `holdextest_bot` hard-coded.
- **C-10:** Vendored SDK.
- **I-16:** No BackButton integration with overlays.
- **No MainButton usage** — the Allocate page has its own custom "Confirm" button instead of the native MainButton. Native MainButton is the conventional choice in Mini Apps; it stays anchored above the keyboard, follows theme colors, and is what users expect.
- **No CloudStorage usage** — onboarding flag (I-17) and any user preferences should live in `webApp.CloudStorage`.
- **No `disableVerticalSwipes` / `enableClosingConfirmation`** for the trading flow. A user can accidentally swipe down and close the app mid-allocation.
- **No `isExpanded` / `requestFullscreen` guard** — on iOS half-height keyboards the layout breaks.
- **No `themeChanged` listener** — the theme params are read once at boot but the user can switch Telegram themes without leaving the app.
- **Deep linking via `startapp` is supported on the backend** (referrals) but the frontend doesn't expose share buttons inside the Mini App's `webApp.openTelegramLink` for prefilled t.me/share/url with custom UTM-like fragments.

### 5. 🎨 UI/UX Quality

**Strengths**
- Cohesive neon/cyber visual identity, consistent neon-cyan/gold/pink palette, glass-morphism cards.
- Loading skeletons exist for prices (`asset-card.tsx:101-111`, `portfolio-card.tsx:55-67`) and the leaderboard (`leaderboard.tsx:90-101`).
- Bottom nav uses `motion.div` with a `layoutId` for smooth tab indicator transitions.
- Touch targets on the bottom nav are ≥ 44 px (`px-3 py-2 rounded-xl flex-1`).
- Use of haptics on every meaningful tap.

**Issues**
- **I-15:** Inconsistent skeleton coverage — dashboard cards and history list flash blank.
- **No empty states:** The Earn page when all tasks are done, the leaderboard when fewer than 15 participants, the position history when empty — all just render nothing or a thin "no data" line.
- **Error states are mostly text:** Failures show a single red banner via `setError(string)`. No retry button, no inline guidance. Consider a `<Alert>` component with structured actions.
- **The Profile sheet has no keyboard escape handler** — only the X button or backdrop tap closes it.
- **The 5x leverage card costing 1 Star (C-2) will be a meme** — fixed-pricing fix also fixes the visual oddity.
- **No accessibility audit:** Many `<button>` motion components lack `aria-label`s, particularly the icon-only ones in `profile.tsx`, `bottom-nav.tsx`, `header.tsx`.
- **No contrast audit:** `text-muted-foreground/50` on `bg-muted/10` (e.g. `prize-pool-card.tsx:107`) is likely below WCAG AA.
- **`<Image>` from `next/image`** is used inconsistently — `profile.tsx:108` uses it, but `app/error.tsx` and some other pages use raw `<img>`.

### 6. 🧪 Testing & Reliability

- **No tests anywhere.** (I-1)
- **Error boundaries:** `app/error.tsx` and `app/global-error.tsx` exist and render a generic "Something went wrong" — good. But they don't ping any error tracker (C-12).
- **No offline/poor-connection handling:** Every `fetch` lacks retry; `catch` blocks show "Network error" toast and stop. Consider a global fetch wrapper with exponential backoff.
- **Socket reconnect:** `lib/socket.ts` enables auto-reconnect (good). But the store doesn't reload state on reconnect — if the server crashed mid-allocation, the client believes the in-flight values are committed.
- **No structured panic recovery:** TwelveData WebSocket has reconnect logic but no circuit breaker for sustained outages.

### 7. 🌐 Localization & Internationalization

- **No i18n at all** (I-14). 100% English UI. Numeric formatting uses `.toLocaleString()` with the user's runtime locale — good but inconsistent (some places pass `undefined`, others a fixed locale).
- **Dates** are computed in UTC for the tournament logic (good for fairness) but displayed without timezone hints. Users in non-UTC timezones see "ends in 12h 34m" but no UTC indicator.
- **Currency formatting** for the TON prize pool uses `.toLocaleString()` without a currency symbol pattern.
- **No RTL test:** Arabic / Persian users will see broken layout.

### 8. 📊 Analytics & Monitoring

- **Frontend:** Only `@vercel/analytics/next` (`app/layout.tsx:91`). No product analytics, no funnel tracking, no Stars purchase conversion tracking.
- **Backend:** Winston logging only. No APM, no traces, no metrics.
- **Business metrics**: There is no way to answer "how many Stars did we collect today?" without raw DB queries.
- **Recommendation:** See C-12.

### 9. 🚀 Deployment & DevOps

- **Hosting:** `render.yaml` deploys the backend (`type: web`, `runtime: node`, `buildCommand: cd server && npm install && npm run build`, `startCommand: cd server && npm start`). `vercel.json` ships the Next app.
- **No CI:** No `.github/workflows/*`, no lint/typecheck/test step. The first time the build will run in production is on `git push`.
- **Env management:** Cleanly separated `.env.example` and `.env.production.example` for the backend; nothing for the frontend (I-20).
- **Secrets:** Per `git ls-files`, no secrets committed. ✓
- **HTTPS:** Render + Vercel enforce HTTPS. ✓ (I-23 for defence-in-depth.)
- **No Dockerfile** — fine for Render's Node buildpack but blocks easy local production-parity testing.

### 10. 📈 Marketing & Growth Readiness

**Strengths**
- **Referral system works end-to-end:** `start_param` → `parseStartParam` → `processReferral` with self-ref + duplicate guards.
- **Stars monetisation is live** with seven SKUs (4 HLX packs, 3 leverage tiers).
- **Weekly tournament** is a strong retention hook with prize-pool visibility.
- **Onboarding tour** exists.

**Issues**
- **C-2, C-3, C-6** above all directly affect launch revenue / virality.
- **No push notifications / bot broadcast strategy** — the bot ID is present but there is no scheduled "your portfolio is up 12% today" DM or "weekly tournament ends in 6h" reminder.
- **Share copy is generic:** `"Join Holdex and start earning HLX tokens!"` (earn.tsx:62). Personalise with the referrer's username and current rank.
- **No social proof on the landing dashboard** — show "1,247 traders competing this week" prominently.
- **No achievement/badge system** — easy retention boost.
- **No daily login bonus** — common pattern in Telegram tap-to-earn / Mini Apps.

### 11. 📋 Documentation

- **C-11:** No README at all.
- **No API docs:** No OpenAPI spec, no Postman collection, no per-route docstrings.
- **No architecture diagram.**
- **No CHANGELOG** — last 10 commits are reasonably descriptive but no formal release notes.
- **No `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`** — fine for a private repo, but `SECURITY.md` should at least list a vuln-disclosure email before public launch.

### 12. 📦 Scalability & High-Load Readiness

**Database**
- MongoDB Atlas (assumed). Indexes are present and reasonable. No N+1 anti-patterns spotted in the current routes — most queries fetch a single user or aggregate in one pipeline.
- **No connection pool tuning** — uses Mongoose defaults. For Render's free tier (1 CPU / 512 MB) the default pool of 100 is overkill; set `maxPoolSize: 20`.
- **The leaderboard `User.find({ weekStart: { $gte: start, $lte: end } }).sort({ portfolioValue: -1 }).limit(500)`** in `services/leaderboard.ts` uses the `{ weekStart: 1, portfolioValue: -1 }` index — good. But sorting 500 docs and projecting in JS adds latency; replace with an aggregation pipeline that returns only the projected fields.

**Backend architecture**
- **Stateful by accident:** rate-limit memory, dedupe sets, Socket.IO without a Redis adapter. Single-process today.
- **Render free tier ceiling:** 1 instance, 512 MB RAM. Estimated capacity: **a few hundred concurrent users** before Socket.IO + JS heap pressure show up. With Redis + an upgraded plan, 10–20k concurrent is plausible.

**Caching**
- None. Recommend Upstash Redis (I-5).

**Concurrency**
- Allocation and sell use transactions — good.
- Stars webhook deduplicates by `update_id` and `telegram_payment_charge_id` (in memory — C-7).
- **No idempotency keys** on client-initiated mutations (`/api/allocation`, `/api/allocation/sell`). A flaky network can submit the same allocation twice, creating duplicate `Position` rows.

**Real-time**
- Socket.IO is the broadcast layer. The `socket.ts` service runs a periodic broadcast every 10 seconds for active users + on every price tick. Without a Redis adapter, horizontal scaling will silently break broadcasts across instances.

**File/media**
- No file uploads. ✓

**Auto-scaling**
- Render web service: no autoscale config in `render.yaml`. Manual scale only.

**Load testing**
- No k6, Artillery, or Locust scripts.

**Bottlenecks (top 3 SPOFs)**
1. The single Node.js process (Render web service).
2. TwelveData WebSocket — if it disconnects and the fallback prices (I-6) are stale, every allocation is calculated against fiction.
3. MongoDB Atlas — single cluster, no read replicas, no failover plan documented.

**Telegram-specific scale risks**
- Bot webhook flood: `/telegram-webhook` is rate-limited only by the general 100-req/min limiter (`server/src/middleware/rateLimit.ts`). A malicious actor pretending to be Telegram (without the secret token) is blocked at 401, but legitimate Telegram retries for a single update can exceed 100/min in a hot loop.
- Concurrent `initData` validations: each is a sync HMAC over ~200 bytes; CPU-light, but with 10k concurrent auth attempts you'd want to cap the auth limiter (currently 20/15min — good).
- Telegram Bot API rate limits: 30 messages/sec global, 1/sec per chat. No queue is implemented for any potential outbound message (e.g. referral confirmation DMs).

### 13. ⚠️ Critical Blockers vs Nice-to-Haves

See top-level categorised sections above. Counts:
- 🔴 Critical: **11 outstanding** (12 originally; C-1 resolved in `beaa496`)
- 🟡 Important: **24** (I-1 partially addressed — Vitest now configured server-side with 1 test)
- 🟢 Nice to have: **15**

---

## Scalability Assessment Summary

- **Estimated Concurrent User Capacity (current single-instance Render setup):** ~**500–1,500 simultaneously connected users** before Socket.IO memory pressure, leaderboard query latency, and in-memory rate-limit contention degrade response times. Per-day MAU could comfortably reach 10–20k as long as concurrency stays under that ceiling.
- **Bottlenecks Before Failure (top 3):**
  1. Single-process Node.js → in-memory state (rate limits, dedupe, sockets) is a hard scale wall.
  2. Leaderboard endpoint (500-doc fetch + sort + serialize) under a poll-on-focus pattern.
  3. MongoDB Atlas free-tier connection cap (500 conns) shared with cron + transactions.
- **Scaling Effort to 10× Users:** **Medium.** Adding Redis (rate limits, dedupe, Socket.IO adapter, leaderboard cache) plus 2-3 instances on Render Pro removes most of the wall. The bigger lift is operational maturity (CI, tests, monitoring), not infra.

---

## Telegram Mini App Specific Checklist

- [x] Calls `Telegram.WebApp.ready()`
- [x] Calls `Telegram.WebApp.expand()`
- [x] Validates `initData` HMAC server-side
- [x] Uses `initDataUnsafe.start_param` for referral attribution
- [x] Stars: creates invoice link via Bot API
- [x] Stars: verifies amount in `pre_checkout_query`
- [x] Stars: validates `X-Telegram-Bot-Api-Secret-Token` on webhook
- [x] Stars: deduplicates by `telegram_payment_charge_id` (in-memory only — fix C-7)
- [x] Implements HapticFeedback
- [x] Reads `themeParams`
- [ ] Loads SDK from `https://telegram.org/js/telegram-web-app.js` (currently vendored — C-10)
- [ ] Uses native MainButton for primary CTAs
- [ ] Uses native BackButton for overlays (I-16)
- [ ] Listens to `themeChanged`
- [ ] Uses CloudStorage for cross-device prefs (I-17)
- [ ] Uses `disableVerticalSwipes` / `enableClosingConfirmation` on critical screens
- [ ] Tested on iOS Telegram, Android Telegram, Telegram Desktop, Telegram Web — **untested in this repo, must be verified manually**
- [ ] Bot username matches production bot (currently `holdextest_bot` — C-6)
- [ ] BotFather: Mini App URL set to production HTTPS domain
- [ ] BotFather: webhook URL set to production `/telegram-webhook`
- [ ] App icon + description set in BotFather

---

## Pre-Release Action Plan

Effort estimates assume one full-time engineer. Order is suggested critical-path.

### Day 1 (must-do before any public link is shared)
1. ~~**C-1** Fix `/api/asset-leverage` URL mismatch and add a smoke test.~~ ✅ Done in `beaa496`.
2. **C-2** Set `lev_5x.starsPrice` to its intended value in `mock-data.ts` AND `routes/stars.ts`. *(~10 min)*
3. **C-6** Replace `holdextest_bot` with the prod bot from env. *(~30 min)*
4. **C-11** Write a minimal `README.md` with local dev + deployment notes. *(~2 h)*
5. **C-12** Hook up Sentry on frontend + backend. *(~2 h)*

### Day 2–3
6. **C-3** Lock down `/api/earn/complete` — gate every reward behind a real check OR demote rewards. *(~6 h)*
7. **C-4** Fix leaderboard rank query (backend + frontend). *(~3 h)*
8. **C-5** Align cron schedule and cooldown window; verify with date-fixed unit tests. *(~2 h)*
9. **C-7** Move dedupe to MongoDB or Redis. *(~3 h)*
10. **C-8** Document the replica-set requirement; add a boot-time check. *(~1 h)*
11. **C-10** Switch to `https://telegram.org/js/telegram-web-app.js`. *(~1 h)*
12. **C-9** Tighten CSP to remove `'unsafe-inline'` scripts; nonce-based inline. *(~4 h)*

### Day 4–5
13. **I-1** Add Vitest with at least 30% coverage on `services/` and the Stars webhook handler. *(~6 h)*
14. **I-3, I-4** Real health checks + graceful shutdown. *(~2 h)*
15. **I-5** Wire Upstash Redis for rate limits + dedupe + Socket.IO adapter. *(~6 h)*
16. **I-6, I-7** Cap leveraged change at -100%; refuse allocations until first real tick. *(~2 h)*
17. **I-8, I-9** Cache leaderboard in Redis; paginate; virtualise the list. *(~4 h)*

### Day 6–7
18. **I-12** CORS preview-URL regex. *(~30 min)*
19. **I-15** Skeletons everywhere. *(~2 h)*
20. **I-16, I-17** Telegram BackButton + CloudStorage for onboarding flag. *(~3 h)*
21. **I-18, I-19** Reconciliation flow for Stars purchases; webhook JSON parse safety. *(~2 h)*
22. **I-24** ESLint config + CI step. *(~1 h)*

### Manual QA (whole team, ½ day)
23. Test on real iOS, Android, and Desktop Telegram. Verify the full critical path: auth → allocate → tick updates → sell → leaderboard rank → Stars purchase (with 1 Star test SKU before C-2 fix) → referral start_param.
24. Run a 5-minute k6 load test against `/api/leaderboard`, `/api/allocation`, and the Socket.IO connection.

**Total estimated effort:** 5–7 engineer-days for a release-ready baseline.

---

## Post-Release Roadmap

### v1.1 (4–6 weeks post-launch)
- Push notifications via the Telegram Bot (daily P&L summary, tournament end reminder, friend leaderboard movements).
- Daily login streak rewards.
- In-app achievement system (first allocation, first 5× leverage, first top-100 finish).
- i18n (en + ru + es + pt + id).
- View Transitions API for page navigation.
- Replace bespoke prize pool with TON Connect on-chain payouts (auditable + trustless).

### v1.2 (2–3 months)
- More assets (ETH, SP500 ETF proxy, oil) gated behind level / referral count.
- "Squad" / clan competitions on top of the individual leaderboard.
- Stars subscriptions for premium features (advanced charts, smaller spread).
- Public REST/GraphQL API + OpenAPI docs (for community-built bots / dashboards).
- A/B testing framework (PostHog feature flags).

### v2.0 (6+ months)
- Multi-region MongoDB + sharded leaderboard.
- Read replicas + edge caching for the static leaderboard payload.
- Web app + standalone iOS/Android shell (since Mini App + native shell can share the same JS bundle).
- Real fiat / TON deposits (not just Stars) with a custodial wallet — opens a regulatory dimension that requires legal review.

---

## Appendix: Files inspected

A non-exhaustive list of files this audit touched (full tree: `git ls-files` returns 142 entries):

- Configs: `next.config.mjs`, `vercel.json`, `render.yaml`, `tsconfig.json`, `server/tsconfig.json`, `package.json` (x2), `components.json`, `postcss.config.mjs`, `.gitignore` (x2)
- App: `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/globals.css`
- Components: `components/app-shell.tsx`, `components/onboarding-tour.tsx`, `components/theme-provider.tsx`, `components/navigation/{header,bottom-nav}.tsx`, `components/dashboard/{portfolio-card,prize-pool-card,asset-card}.tsx`, `components/allocation/allocation-slider.tsx`, `components/pages/{dashboard,allocate,store,earn,leaderboard,profile}.tsx`
- Hooks/lib: `hooks/{use-telegram,use-socket,use-mobile}.ts`, `lib/{store,types,socket,utils,debug,mock-data}.ts`
- Backend: `server/src/index.ts`, `server/src/config/env.ts`, `server/src/db/connect.ts`, `server/src/db/models/{User,Position,Leaderboard}.ts`, `server/src/middleware/{auth,rateLimit,validate,socketRateLimit}.ts`, `server/src/services/{auth,telegram,socket,portfolio,twelveData,leaderboard,referral}.ts`, `server/src/routes/{auth,allocation,stars,earn,leaderboard,referral}.ts`, `server/src/utils/logger.ts`
- Env templates: `.env.example`, `.env.production.example`, `server/.env.example`, `server/.env.production.example`
