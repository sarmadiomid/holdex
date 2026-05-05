# Deploy Holdex to Production

## Architecture

```
Frontend (Next.js) → Vercel
Backend (Express)  → Render
Database           → MongoDB Atlas
Real-time Prices   → TwelveData WebSocket
```

---

## 1. MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com/
2. Create a free cluster (M0)
3. Create database user with read/write access
4. Network Access → Add `0.0.0.0/0` (allow from anywhere)
5. Copy connection string:
   ```
   mongodb+srv://<user>:<password>@cluster.mongodb.net/holdex
   ```

---

## 2. Backend Deployment (Render)

1. Push your code to GitHub
2. Go to https://render.com/
3. New → **Blueprint** → Connect your repo
4. Render reads `render.yaml` automatically
5. Fill in environment variables:
   - `MONGODB_URI` — from Step 1
   - `TELEGRAM_BOT_TOKEN` — from @BotFather
   - `JWT_SECRET` — run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `TWELVE_DATA_API_KEY` — from https://twelvedata.com/
   - `FRONTEND_URL` — your Vercel URL (e.g., `https://holdex.vercel.app`)
6. Deploy → Wait ~2 minutes
7. Copy your backend URL: `https://holdex-backend.onrender.com`

---

## 3. Frontend Deployment (Vercel)

1. Go to https://vercel.com/
2. New Project → Import your GitHub repo
3. Root Directory: leave blank (frontend is at root)
4. Build Command: `npm run build`
5. Output Directory: `.next`
6. Add Environment Variables:
   - `NEXT_PUBLIC_BACKEND_URL` — your Render URL from Step 2
7. Deploy → Wait ~1 minute
8. Copy your frontend URL: `https://holdex.vercel.app`

---

## 4. Connect Telegram Bot

1. Go to @BotFather on Telegram
2. `/mybots` → Select your bot → Bot Settings → Menu Button
3. Set menu button URL to your Vercel URL
4. Or use deep links: `https://t.me/yourbot?startapp=referral_id`

---

## 5. Update Environment Variables

After deployment, update each side with the other's URL:

**In Render (backend):**
- `FRONTEND_URL` → `https://holdex.vercel.app`

**In Vercel (frontend):**
- `NEXT_PUBLIC_BACKEND_URL` → `https://holdex-backend.onrender.com`

Redeploy both after updating.

---

## Troubleshooting

- **Backend not connecting to MongoDB**: Check IP whitelist in Atlas (use `0.0.0.0/0`)
- **CORS errors**: Verify `FRONTEND_URL` in Render matches your Vercel URL exactly
- **Socket.io connection failed**: Check browser console for the correct backend URL
- **TwelveData not receiving prices**: Verify API key and plan supports WebSocket
- **Render cold starts**: Free tier sleeps after 15min idle — use a service like UptimeRobot to ping `/health` every 5min
