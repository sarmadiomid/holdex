import { env } from '../config/env'
import { logger } from '../utils/logger'

interface ChatMemberResponse {
  ok: boolean
  result?: {
    status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'
    user: {
      id: number
      is_bot: boolean
      first_name: string
    }
  }
  description?: string
}

interface SetWebhookResponse {
  ok: boolean
  result: boolean
  description?: string
}

export async function setupTelegramWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true,
      }),
    })

    const data: SetWebhookResponse = await response.json()

    if (!data.ok) {
      logger.error('Failed to set Telegram webhook', { error: data.description, webhookUrl })
      return false
    }

    logger.info('Telegram webhook set successfully', { webhookUrl })
    return true
  } catch (error) {
    logger.error('Error setting Telegram webhook', { error, webhookUrl })
    return false
  }
}

export async function getWebhookInfo(): Promise<{ webhook_url: string; has_custom_certificate: boolean; pending_update_count: number } | null> {
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    const response = await fetch(url)
    const data = await response.json()

    if (data.ok) {
      return data.result
    }
    return null
  } catch (error) {
    logger.error('Error getting webhook info', { error })
    return null
  }
}

/**
 * Check if a user is a member of a Telegram channel/group
 * @param userId - Telegram user ID
 * @param chatId - Channel/Group ID (e.g., @channelname or -1001234567890)
 * @returns true if user is a member, false otherwise
 */
export async function checkChannelMembership(
  userId: number,
  chatId: string,
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId,
      }),
    })

    const data: ChatMemberResponse = await response.json()

    if (!data.ok) {
      logger.warn(`Failed to check channel membership: ${data.description}`)
      return false
    }

    // User is considered a member if they have any of these statuses
    const memberStatuses = ['creator', 'administrator', 'member']
    const isMember = !!(data.result && memberStatuses.includes(data.result.status))

    logger.info(
      `Channel membership check: userId=${userId}, chatId=${chatId}, status=${data.result?.status}, isMember=${isMember}`,
    )

    return isMember
  } catch (error) {
    logger.error('Error checking channel membership', { error, userId, chatId })
    return false
  }
}

/**
 * Get channel/group ID from username
 * Note: The bot must be an admin in the channel for this to work
 */
export async function getChatInfo(chatId: string): Promise<{
  id: number
  title: string
  type: string
} | null> {
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChat`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      logger.warn(`Failed to get chat info: ${data.description}`)
      return null
    }

    return data.result
  } catch (error) {
    logger.error('Error getting chat info', { error, chatId })
    return null
  }
}

/**
 * Create a Telegram Stars invoice link using Bot API
 * @param params - Invoice parameters
 * @returns Invoice link or null on error
 */
export async function createStarsInvoiceLink(params: {
  title: string
  description: string
  payload: string
  amount: number
}): Promise<string | null> {
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        payload: params.payload,
        provider_token: '', // Required empty string for Telegram Stars payments
        currency: 'XTR', // XTR is the currency code for Telegram Stars
        prices: [{ label: 'Telegram Stars', amount: params.amount }],
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      logger.error('Failed to create Stars invoice link', { 
        error: data.description,
        params 
      })
      return null
    }

    logger.info('Created Stars invoice link', { payload: params.payload })
    return data.result
  } catch (error) {
    logger.error('Error creating Stars invoice link', { error, params })
    return null
  }
}
