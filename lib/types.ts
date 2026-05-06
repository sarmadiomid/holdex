// Asset types
export type AssetType = 'BTC' | 'GOLD' | 'OIL'

export interface Asset {
  id: AssetType
  name: string
  symbol: string
  icon: string
  price: number
  change24h: number
  allocation: number // percentage allocated
  color: string
}

// User state
export interface User {
  id: string
  telegramId?: number
  username: string
  firstName: string
  lastName: string
  photoUrl?: string
  balance: number // HLX tokens
  portfolioValue: number
  totalPnl: number
  totalPnlPercent: number
  leverage: number // 1x, 2x, 5x, 10x
  rank?: number
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number
  user: {
    id: string
    username: string
    firstName: string
    photoUrl?: string
  }
  portfolioValue: number
  pnl: number
  pnlPercent: number
}

// Store item (price in Telegram Stars)
export interface StoreItem {
  id: string
  name: string
  description: string
  starsPrice: number // Price in Telegram Stars
  type: 'hlx' | 'leverage'
  value?: number // amount of HLX or leverage multiplier
}

// Prize Pool
export interface PrizePool {
  totalTon: number // Total prize in TON
  distribution: {
    rank: number
    percentage: number
    tonAmount: number // Prize in TON
  }[]
  endsAt: number // Timestamp when weekly tournament ends
  totalParticipants: number
  season: number // Weekly season number
}

// Telegram types
export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    auth_date?: number
    hash?: string
  }
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
  }
  expand: () => void
  close: () => void
  ready: () => void
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  openInvoice: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

// Price update
export interface PriceUpdate {
  assetId: AssetType
  price: number
  change24h: number
  timestamp: number
}

// Transaction
export interface Transaction {
  id: string
  type: 'buy' | 'sell' | 'allocate' | 'store_purchase'
  amount: number
  assetId?: AssetType
  timestamp: number
  description: string
}

// Earn Task
export interface EarnTask {
  id: string
  title: string
  description: string
  reward: number // HLX tokens
  type: 'follow' | 'watch' | 'visit' | 'share' | 'invite'
  url?: string
  icon: string
  completed: boolean
}
