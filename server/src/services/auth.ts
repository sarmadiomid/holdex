import crypto from 'crypto'

export function validateTelegramInitData(initData: string, botToken: string): {
  valid: boolean
  data: Record<string, string> | null
} {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')

  if (!hash) {
    return { valid: false, data: null }
  }

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computedHash !== hash) {
    return { valid: false, data: null }
  }

  const data: Record<string, string> = {}
  params.forEach((value, key) => {
    data[key] = value
  })

  return { valid: true, data }
}

export function parseTelegramUser(data: Record<string, string>) {
  const userStr = data.user
  if (!userStr) return null

  try {
    return JSON.parse(userStr) as {
      id: number
      first_name: string
      last_name?: string
      username?: string
      photo_url?: string
      language_code?: string
    }
  } catch {
    return null
  }
}

export function parseStartParam(initData: string): string | null {
  const params = new URLSearchParams(initData)
  const startParam = params.get('startapp') || params.get('start_param')
  return startParam || null
}
