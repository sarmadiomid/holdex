# Telegram Mini App Referral Setup Guide

## Problem
When users click referral links like `https://t.me/holdextest_bot?start=123`, the `/start` command is sent to the bot, but when they open the Mini App, the referral parameter is not passed to the web app.

## Solution

### 1. Configure Mini App in BotFather

You need to set up your Mini App properly in BotFather:

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/mybots`
3. Select your bot: `@holdextest_bot`
4. Select **"Bot Settings"**
5. Select **"Configure Mini App"** (or "Menu Button" → "Configure Mini App")
6. Enter your Mini App URL (e.g., `https://your-domain.vercel.app`)
7. Enter a **short name** for your app (e.g., `holdex`)

### 2. Referral Link Format

After configuring the Mini App, use this format for referral links:

```
https://t.me/holdextest_bot/holdex?startapp=REFERRAL_CODE
```

**Format breakdown:**
- `holdextest_bot` - your bot username
- `holdex` - the short name you set in BotFather
- `startapp=REFERRAL_CODE` - the referral parameter

**Example:**
```
https://t.me/holdextest_bot/holdex?startapp=123456789
```

### 3. How It Works

When a user clicks the referral link:
1. Telegram opens the bot
2. The Mini App launches automatically (no need to press "Open" button)
3. The `startapp` parameter is converted to `start_param` in the `initData`
4. Your backend receives it in the authentication flow

### 4. Alternative: Attach Menu Link

You can also use the attach menu format:

```
https://t.me/holdextest_bot?startattach=REFERRAL_CODE
```

This opens the bot with an "Open App" button, and when clicked, passes the parameter as `start_param`.

### 5. Testing

To test if it's working:

1. Create a referral link: `https://t.me/holdextest_bot/holdex?startapp=test123`
2. Send it to another Telegram account
3. Click the link
4. The Mini App should open automatically
5. Check your backend logs - you should see: `Referral reward: 10 HLX to user X for referring Y`

### 6. Code Changes Made

The code has been updated to:
- Parse `start_param` from `initData` (this is what Telegram sends)
- Generate referral links in the correct format: `https://t.me/holdextest_bot/holdex?startapp={telegramId}`
- Process referrals only for new users
- Award 10 HLX to the referrer
- Create a Position record for tracking

### 7. Important Notes

- The `start` parameter in bot links (`?start=123`) is for bot commands, NOT for Mini Apps
- Mini Apps use `startapp` in the URL, which becomes `start_param` in initData
- You MUST configure the Mini App in BotFather for this to work
- The short name in the URL must match what you set in BotFather
- Maximum parameter length: 512 characters
- Allowed characters: A-Z, a-z, 0-9, _ (underscore), - (minus)

### 8. Debugging

If referrals still don't work:

1. Check BotFather configuration:
   - Is the Mini App URL set correctly?
   - Is the short name correct?

2. Check the initData in your frontend:
   ```javascript
   console.log('initData:', window.Telegram.WebApp.initData)
   ```
   Look for `start_param=` in the output

3. Check backend logs:
   - Is `parseStartParam` returning a value?
   - Is `processReferral` being called?

4. Test with a direct link:
   ```
   https://t.me/holdextest_bot/holdex?startapp=999
   ```
   Replace `holdex` with your actual short name from BotFather
