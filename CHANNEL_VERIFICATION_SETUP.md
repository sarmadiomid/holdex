# Telegram Channel Subscription Verification Setup

## How It Works

The system uses Telegram Bot API's `getChatMember` method to verify if a user has actually joined a channel before giving them the HLX reward.

## Setup Steps

### 1. Create Your Telegram Channel

1. Open Telegram and create a new channel (or use an existing one)
2. Make it public and set a username (e.g., `@holdex_channel`)
3. Note down the channel username

### 2. Add Your Bot as Administrator

**CRITICAL:** Your bot MUST be an admin in the channel for verification to work.

1. Open your channel
2. Go to **Channel Info** → **Administrators**
3. Click **Add Administrator**
4. Search for your bot (`@holdextest_bot`)
5. Add it with at least these permissions:
   - ✅ **Post Messages** (optional, but recommended)
   - The bot doesn't need other special permissions for verification

### 3. Get Channel ID (Alternative to Username)

If you want to use channel ID instead of username:

1. Open your channel in Telegram Web: `web.telegram.org`
2. Look at the URL: `web.telegram.org/a/#-1234567890`
3. The number at the end is your channel ID
4. Add `-100` prefix: `-1001234567890`

### 4. Configure in Code

Open `server/src/routes/earn.ts` and update the `CHANNEL_VERIFICATION` object:

```typescript
const CHANNEL_VERIFICATION: Record<string, string> = {
  'follow-telegram': '@holdex_channel', // Your channel username
  // Or use channel ID:
  // 'follow-telegram': '-1001234567890',
}
```

### 5. Update Task URLs

In `lib/mock-data.ts`, update the Telegram channel task URL:

```typescript
{
  id: 'follow-telegram',
  title: 'Join Telegram Channel',
  description: 'Join our official Telegram channel',
  reward: 500,
  type: 'follow',
  url: 'https://t.me/holdex_channel', // Your channel link
  icon: '✈️',
  completed: false
}
```

## How Verification Works

1. User clicks on a task (e.g., "Join Telegram Channel")
2. Frontend opens the channel link in Telegram
3. User joins the channel
4. User returns to the Mini App and the task auto-completes after 2 seconds
5. Backend calls Telegram API: `getChatMember` with user's ID and channel ID
6. Telegram returns the user's status:
   - `creator` - Channel owner ✅
   - `administrator` - Channel admin ✅
   - `member` - Regular member ✅
   - `left` - Not a member ❌
   - `kicked` - Banned from channel ❌
7. If status is `creator`, `administrator`, or `member`, reward is given
8. If not, user gets an error: "Please join the channel first and try again"

## Testing

### Test Channel Verification:

1. Create a test channel
2. Add your bot as admin
3. Update the channel ID in `CHANNEL_VERIFICATION`
4. Try to complete the task WITHOUT joining → Should fail
5. Join the channel
6. Try to complete the task → Should succeed and give 500 HLX

### Debug Logs:

Check your server logs for:
```
Channel membership check: userId=123456, chatId=@holdex_channel, status=member, isMember=true
Channel membership verified for user 123456, task follow-telegram
Task follow-telegram completed by user 123456, reward: 500
```

## Adding More Verified Tasks

You can add verification for other channels/groups:

```typescript
const CHANNEL_VERIFICATION: Record<string, string> = {
  'follow-telegram': '@holdex_channel',
  'follow-instagram': '@holdex_instagram', // Won't work - Instagram not supported
  'join-community': '@holdex_community',   // Another Telegram channel
  'join-group': '-1001234567890',          // Telegram group by ID
}
```

**Note:** Only Telegram channels/groups can be verified. Twitter, Instagram, etc. cannot be verified automatically.

## Common Issues

### Issue: "Channel membership verification failed"

**Causes:**
1. Bot is not an admin in the channel
2. Wrong channel ID/username
3. User hasn't actually joined
4. Channel is private and bot can't access it

**Solution:**
- Make sure bot is admin with proper permissions
- Use correct channel username (with @) or ID (with -100 prefix)
- Make channel public or add bot as admin

### Issue: Bot returns "Chat not found"

**Cause:** Channel ID/username is incorrect

**Solution:**
- For public channels: Use `@channelname`
- For private channels: Use numeric ID with `-100` prefix
- Verify the channel exists and bot is admin

### Issue: Always returns "left" status

**Cause:** Bot doesn't have permission to see members

**Solution:**
- Make sure bot is added as administrator
- Check bot has "View Members" permission (usually automatic for admins)

## API Rate Limits

Telegram Bot API has rate limits:
- ~30 requests per second per bot
- If you have many users completing tasks simultaneously, consider:
  - Adding a queue system
  - Caching verification results for a few minutes
  - Rate limiting task completion attempts

## Security Notes

1. **Never expose your bot token** - It's in `.env` files, keep them secure
2. **Validate on backend** - Always verify on server, never trust frontend
3. **Prevent abuse** - The code already prevents:
   - Completing same task twice
   - Completing without channel membership
4. **Monitor logs** - Watch for suspicious patterns (mass task completions, etc.)

## Alternative: Manual Verification

If automatic verification doesn't work for your use case, you can:

1. Remove channel from `CHANNEL_VERIFICATION`
2. Task will complete without verification (honor system)
3. Manually review suspicious accounts
4. Ban users who abuse the system

## Code Files Modified

- `server/src/services/telegram.ts` - New service for Telegram API calls
- `server/src/routes/earn.ts` - Added verification logic
- `components/pages/earn.tsx` - Better error handling
- `lib/mock-data.ts` - Update channel URLs

## Next Steps

1. Create your Telegram channel
2. Add bot as admin
3. Update `CHANNEL_VERIFICATION` with your channel username
4. Update task URLs in `mock-data.ts`
5. Test with a real user account
6. Monitor logs for verification success/failures
