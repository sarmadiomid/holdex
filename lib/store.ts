'use client'

import { create } from 'zustand'
import type { Asset, User, AssetType, LeaderboardEntry, Transaction, PrizePool, EarnTask, PositionHistoryEntry } from './types'

interface BackendLeaderboardEntry {
  rank: number
  telegramId: number
  username: string
  firstName: string
  photoUrl?: string
  portfolioValue: number
  pnl: number
  pnlPercent: number
}

interface AppState {
  user: User
  isAuthenticated: boolean
  token: string | null
  isTourCompleted: boolean

  assets: Asset[]
  allocations: Record<AssetType, number>
  initialPrices: Record<AssetType, number | null>
  pricesLoaded: boolean

  leaderboard: LeaderboardEntry[]
  leaderboardData: {
    season: number
    totalParticipants: number
    prizePool: number
    distribution: { rank: number; percentage: number; tonAmount: number }[]
    weekStart: Date
    weekEnd: Date
    entries: LeaderboardEntry[]
    userPosition: {
      portfolioValue: number
      pnl: number
      pnlPercent: number
      rank: number | null
    } | null
  } | null

  prizePool: PrizePool

  transactions: Transaction[]

  positionHistory: PositionHistoryEntry[]

  earnTasks: EarnTask[]

  activeTab: 'dashboard' | 'allocate' | 'store' | 'leaderboard' | 'earn'

  setActiveTab: (tab: 'dashboard' | 'allocate' | 'store' | 'leaderboard' | 'earn') => void
  setTourCompleted: () => void
  completeTask: (taskId: string) => void
  setToken: (token: string | null) => void
  setAuthenticatedUser: (userData: User, token: string) => void
  updateAssetPrice: (twelveDataSymbol: string, price: number, change24h?: number) => void
  setUserPrices: (data: Record<string, { symbol: string; price: number; change24h: number; timestamp: number }>) => void
  updateUserFromSocket: (data: { 
    portfolioValue?: number
    totalPnl?: number
    totalPnlPercent?: number
    assetLeverages?: Record<string, number>
    initialPrices?: Record<string, number | null>
  }) => void
  setAllocations: (allocations: Record<AssetType, number>) => void
  updatePortfolioValue: () => void
  setUser: (user: Partial<User>) => void
  addTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => void
  setLeaderboard: (data: {
    season: number
    totalParticipants: number
    prizePool: number
    distribution: { rank: number; percentage: number; tonAmount: number }[]
    weekStart: string
    weekEnd: string
    entries: BackendLeaderboardEntry[]
    userPosition: {
      portfolioValue: number
      pnl: number
      pnlPercent: number
      rank: number | null
    } | null
    phase?: 'active' | 'cooldown'
    phaseEndsAt?: string
    nextPhaseStartsAt?: string
  }) => void
  syncPrizePoolWithPhase: (phase: 'active' | 'cooldown', phaseEndsAt: string, nextPhaseStartsAt: string) => void
  setLeverage: (leverage: number) => void
  setAssetLeverage: (assetId: AssetType, leverage: number) => void
  setPositionHistory: (history: PositionHistoryEntry[]) => void
  addBalance: (amount: number) => void
  applySellResult: (newBalance: number) => void
}

const createInitialPrices = (): Record<AssetType, number | null> => ({
  BTC: null,
  GOLD: null,
  EUR: null,
})

const TWELVE_DATA_TO_ASSET: Record<string, AssetType> = {
  'BTC/USD': 'BTC',
  'XAU/USD': 'GOLD',
  'EUR/USD': 'EUR',
}

export const useAppStore = create<AppState>((set, get) => ({
  user: {
    id: '',
    username: '',
    firstName: '',
    lastName: '',
    balance: 100,
    portfolioValue: 100,
    totalPnl: 0,
    totalPnlPercent: 0,
    leverage: 1,
    assetLeverages: { BTC: 1, GOLD: 1, EUR: 1 },
  },
  isAuthenticated: false,
  token: null,
  assets: [
    { id: 'BTC', name: 'Bitcoin', symbol: 'BTC', icon: '₿', price: 0, change24h: 0, allocation: 0, color: 'neon-gold' },
    { id: 'GOLD', name: 'Gold', symbol: 'XAU', icon: '🥇', price: 0, change24h: 0, allocation: 0, color: 'neon-cyan' },
    { id: 'EUR', name: 'Euro/USD', symbol: 'EUR/USD', icon: '💶', price: 0, change24h: 0, allocation: 0, color: 'neon-pink' },
  ],
  allocations: { BTC: 0, GOLD: 0, EUR: 0 },
  initialPrices: createInitialPrices(),
  pricesLoaded: false,
  leaderboard: [],
  leaderboardData: null,
  prizePool: {
    totalTon: 500,
    distribution: [
      { rank: 1, percentage: 40, tonAmount: 200 },
      { rank: 2, percentage: 25, tonAmount: 125 },
      { rank: 3, percentage: 15, tonAmount: 75 },
      { rank: 4, percentage: 10, tonAmount: 50 },
      { rank: 5, percentage: 5, tonAmount: 25 },
      { rank: 6, percentage: 3, tonAmount: 15 },
      { rank: 7, percentage: 2, tonAmount: 10 },
    ],
    endsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    totalParticipants: 0,
    season: 1,
    phase: 'active',
    nextPhaseStartsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
  transactions: [],
  positionHistory: [],
  earnTasks: [
    { id: 'follow-twitter', title: 'Follow us on Twitter', description: 'Follow @HoldexApp on Twitter for updates', reward: 500, type: 'follow', url: 'https://twitter.com/HoldexApp', icon: '𝕏', completed: false },
    { id: 'follow-telegram', title: 'Join Telegram Channel', description: 'Join our official Telegram channel', reward: 500, type: 'follow', url: 'https://t.me/holdex_channel', icon: '✈️', completed: false },
    { id: 'watch-tutorial', title: 'Watch Tutorial Video', description: 'Learn how to maximize your profits', reward: 300, type: 'watch', url: 'https://youtube.com/watch?v=tutorial', icon: '📺', completed: false },
    { id: 'visit-website', title: 'Visit Our Website', description: 'Check out the full Holdex platform', reward: 200, type: 'visit', url: 'https://holdex.app', icon: '🌐', completed: false },
    { id: 'share-app', title: 'Share with Friends', description: 'Share Holdex with 3 friends', reward: 1000, type: 'share', icon: '🔗', completed: false },
    { id: 'invite-5', title: 'Invite 5 Friends', description: 'Invite 5 friends to join Holdex', reward: 2500, type: 'invite', icon: '👥', completed: false },
    { id: 'follow-instagram', title: 'Follow on Instagram', description: 'Follow @holdex.app on Instagram', reward: 500, type: 'follow', url: 'https://instagram.com/holdex.app', icon: '📸', completed: false },
    { id: 'watch-demo', title: 'Watch Platform Demo', description: 'Watch our 2-minute platform demo', reward: 300, type: 'watch', url: 'https://youtube.com/watch?v=demo', icon: '🎬', completed: false },
  ],
  activeTab: 'dashboard',

  isTourCompleted: typeof window !== 'undefined' ? localStorage.getItem('holdex_tour_completed') === 'true' : false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setTourCompleted: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('holdex_tour_completed', 'true')
    }
    set({ isTourCompleted: true })
  },

  completeTask: (taskId) => {
    set((state) => {
      const task = state.earnTasks.find((t) => t.id === taskId)
      if (!task || task.completed) return state

      const newBalance = Math.max(0, state.user.balance + task.reward)
      return {
        earnTasks: state.earnTasks.map((t) =>
          t.id === taskId ? { ...t, completed: true } : t
        ),
        user: {
          ...state.user,
          balance: newBalance,
          portfolioValue: Math.max(0, state.user.portfolioValue + task.reward),
        },
      }
    })
  },

  setToken: (token) => set({ token }),

  setAuthenticatedUser: (userData: any, token) => set((state) => {
    const completedTasks = userData.completedTasks || []
    const updatedEarnTasks = state.earnTasks.map(task => ({
      ...task,
      completed: completedTasks.includes(task.id)
    }))
    return {
      user: {
        ...userData,
        assetLeverages: userData.assetLeverages || { BTC: 1, GOLD: 1, EUR: 1 },
      },
      token,
      isAuthenticated: true,
      earnTasks: updatedEarnTasks,
      allocations: userData.allocations || { BTC: 0, GOLD: 0, EUR: 0 },
      initialPrices: userData.initialPrices || createInitialPrices(),
    }
  }),

  updateAssetPrice: (twelveDataSymbol, price, change24hFromServer) => {
    const assetId = TWELVE_DATA_TO_ASSET[twelveDataSymbol]
    if (!assetId) return

    set((state) => {
      const assetIndex = state.assets.findIndex((a) => a.id === assetId)
      if (assetIndex === -1) return state

      const updatedAssets = [...state.assets]
      const change24h = change24hFromServer ?? (updatedAssets[assetIndex].price > 0 ? ((price - updatedAssets[assetIndex].price) / updatedAssets[assetIndex].price) * 100 : 0)
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        price,
        change24h: Math.round(change24h * 100) / 100,
      }

      // Client-side portfolio calculation for real-time display
      // Server is authoritative for sell PnL and leaderboard
      const assetLeverages = state.user.assetLeverages || { BTC: state.user.leverage, GOLD: state.user.leverage, EUR: state.user.leverage }
      let totalValue = 0
      let totalAllocated = 0

      for (const asset of updatedAssets) {
        const allocation = state.allocations[asset.id] || 0
        const allocatedAmount = (state.user.balance * allocation) / 100
        totalAllocated += allocation

        if (allocatedAmount > 0 && state.initialPrices[asset.id]) {
          const priceChange = (asset.price - state.initialPrices[asset.id]!) / state.initialPrices[asset.id]!
          const multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }
          const amplifiedChange = priceChange * (multipliers[asset.id] || 50)
          const assetLeverage = assetLeverages[asset.id] || state.user.leverage
          const leveragedChange = amplifiedChange * assetLeverage
          totalValue += allocatedAmount * (1 + leveragedChange)
        }
      }

      const unallocatedPercent = 100 - totalAllocated
      totalValue += (state.user.balance * unallocatedPercent) / 100

      const pnl = totalValue - state.user.balance
      const pnlPercent = state.user.balance > 0 ? (pnl / state.user.balance) * 100 : 0
      const optimisticValue = Math.max(0, Math.round(totalValue * 100) / 100)

      return {
        assets: updatedAssets,
        pricesLoaded: true,
        user: {
          ...state.user,
          portfolioValue: optimisticValue,
          totalPnl: Math.round(pnl * 100) / 100,
          totalPnlPercent: Math.round(pnlPercent * 100) / 100,
        },
      }
    })
  },

  setUserPrices: (data) => {
    const priceMap: Record<string, { price: number; change24h: number }> = {}
    const freshInitialPrices = { ...get().initialPrices }

    for (const [symbol, item] of Object.entries(data)) {
      const assetId = TWELVE_DATA_TO_ASSET[symbol]
      if (assetId) {
        priceMap[assetId] = { price: item.price, change24h: item.change24h }
        if (freshInitialPrices[assetId] === null) {
          freshInitialPrices[assetId] = item.price
        }
      }
    }

    set((state) => {
      const updatedAssets = state.assets.map((asset) => {
        const item = priceMap[asset.id]
        if (item) {
          const change24h = item.change24h ?? (state.pricesLoaded && asset.price > 0 
            ? ((item.price - asset.price) / asset.price) * 100 
            : 0)
          return { ...asset, price: item.price, change24h: Math.round(change24h * 100) / 100 }
        }
        return asset
      })

      const assetLeverages = state.user.assetLeverages || { BTC: state.user.leverage, GOLD: state.user.leverage, EUR: state.user.leverage }
      let totalValue = 0
      let totalAllocated = 0

      for (const asset of updatedAssets) {
        const allocation = state.allocations[asset.id] || 0
        const allocatedAmount = (state.user.balance * allocation) / 100
        totalAllocated += allocation

        if (allocatedAmount > 0 && freshInitialPrices[asset.id]) {
          const priceChange = (asset.price - freshInitialPrices[asset.id]!) / freshInitialPrices[asset.id]!
          const multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }
          const amplifiedChange = priceChange * (multipliers[asset.id] || 50)
          const assetLeverage = assetLeverages[asset.id] || state.user.leverage
          const leveragedChange = amplifiedChange * assetLeverage
          totalValue += allocatedAmount * (1 + leveragedChange)
        }
      }

      const unallocatedPercent = 100 - totalAllocated
      totalValue += (state.user.balance * unallocatedPercent) / 100

      const pnl = totalValue - state.user.balance
      const pnlPercent = state.user.balance > 0 ? (pnl / state.user.balance) * 100 : 0
      const optimisticValue = Math.max(0, Math.round(totalValue * 100) / 100)

      return {
        assets: updatedAssets,
        initialPrices: freshInitialPrices,
        pricesLoaded: true,
        user: {
          ...state.user,
          portfolioValue: optimisticValue,
          totalPnl: Math.round(pnl * 100) / 100,
          totalPnlPercent: Math.round(pnlPercent * 100) / 100,
        },
      }
    })
  },

  updateUserFromSocket: (data) => {
    set((state) => {
      const updates: Partial<User> = {}
      
      // Update portfolio values if provided
      if (data.portfolioValue !== undefined) updates.portfolioValue = data.portfolioValue
      if (data.totalPnl !== undefined) updates.totalPnl = data.totalPnl
      if (data.totalPnlPercent !== undefined) updates.totalPnlPercent = data.totalPnlPercent
      if (data.assetLeverages !== undefined) updates.assetLeverages = data.assetLeverages
      
      // Update initialPrices if provided (fixes race condition on allocation)
      const newInitialPrices = data.initialPrices 
        ? { ...state.initialPrices, ...data.initialPrices }
        : state.initialPrices
      
      return {
        user: {
          ...state.user,
          ...updates,
        },
        initialPrices: newInitialPrices,
      }
    })
  },

  setAllocations: (allocations) => set({ allocations }),

   updatePortfolioValue: () => {
    const { assets, allocations, initialPrices, user } = get()
    if (user.balance <= 0) {
      set({
        user: {
          ...user,
          balance: 0,
          portfolioValue: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
        },
        allocations: { BTC: 0, GOLD: 0, EUR: 0 },
        initialPrices: createInitialPrices(),
      })
      return
    }
    const assetLeverages = user.assetLeverages || { BTC: user.leverage, GOLD: user.leverage, EUR: user.leverage }
    let totalValue = 0
    let totalAllocated = 0

    for (const asset of assets) {
      const allocation = allocations[asset.id] || 0
      const allocatedAmount = (user.balance * allocation) / 100
      totalAllocated += allocation

      if (allocatedAmount > 0 && initialPrices[asset.id]) {
        const priceChange = (asset.price - initialPrices[asset.id]!) / initialPrices[asset.id]!
        const multipliers: Record<string, number> = { BTC: 100, GOLD: 50, EUR: 1000 }
        const amplifiedChange = priceChange * (multipliers[asset.id] || 50)
        const assetLeverage = assetLeverages[asset.id] || user.leverage
        const leveragedChange = amplifiedChange * assetLeverage
        totalValue += allocatedAmount * (1 + leveragedChange)
      }
    }

    const unallocatedPercent = 100 - totalAllocated
    totalValue += (user.balance * unallocatedPercent) / 100

    const pnl = totalValue - user.balance
    const pnlPercent = user.balance > 0 ? (pnl / user.balance) * 100 : 0

    const newBalance = Math.max(0, Math.round(totalValue * 100) / 100)
    set({
      user: {
        ...user,
        balance: newBalance,
        portfolioValue: newBalance,
        totalPnl: Math.round(pnl * 100) / 100,
        totalPnlPercent: Math.round(pnlPercent * 100) / 100,
      },
    })
  },

  setUser: (userData) => {
    const { user } = get()
    set({ user: { ...user, ...userData }, isAuthenticated: true })
  },

  addTransaction: (transaction) => {
    const { transactions } = get()
    const newTransaction: Transaction = {
      ...transaction,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    }
    set({ transactions: [newTransaction, ...transactions].slice(0, 50) })
  },

  setLeaderboard: (data) => {
    const entries: LeaderboardEntry[] = data.entries.map((e) => ({
      rank: e.rank,
      user: {
        id: String(e.telegramId),
        username: e.username,
        firstName: e.firstName,
        photoUrl: e.photoUrl,
      },
      portfolioValue: e.portfolioValue,
      pnl: e.pnl,
      pnlPercent: e.pnlPercent,
    }))

    const phase = data.phase || 'active'
    const phaseEndsAt = data.phaseEndsAt ? new Date(data.phaseEndsAt).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000
    const nextPhaseStartsAt = data.nextPhaseStartsAt ? new Date(data.nextPhaseStartsAt).getTime() : phaseEndsAt

    set((state) => ({
      leaderboard: entries,
      leaderboardData: {
        season: data.season,
        totalParticipants: data.totalParticipants,
        prizePool: data.prizePool,
        distribution: data.distribution,
        weekStart: new Date(data.weekStart),
        weekEnd: new Date(data.weekEnd),
        entries,
        userPosition: data.userPosition,
      },
      prizePool: {
        ...state.prizePool,
        endsAt: phaseEndsAt,
        phase,
        nextPhaseStartsAt,
        season: data.season,
        totalTon: data.prizePool,
        distribution: data.distribution,
        totalParticipants: data.totalParticipants,
      },
    }))
  },

  syncPrizePoolWithPhase: (phase, phaseEndsAt, nextPhaseStartsAt) => {
    set((state) => ({
      prizePool: {
        ...state.prizePool,
        phase,
        endsAt: new Date(phaseEndsAt).getTime(),
        nextPhaseStartsAt: new Date(nextPhaseStartsAt).getTime(),
      },
    }))
  },

  setLeverage: (leverage) => {
    set((state) => ({ user: { ...state.user, leverage } }))
  },

  setAssetLeverage: (assetId, leverage) => {
    const token = get().token
    // Optimistic update
    set((state) => {
      const assetLeverages = state.user.assetLeverages || { BTC: 1, GOLD: 1, EUR: 1 }
      return {
        user: {
          ...state.user,
          assetLeverages: { ...assetLeverages, [assetId]: leverage }
        }
      }
    })
    // Sync with backend
    if (token) {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
      fetch(`${BACKEND_URL}/api/allocation/asset-leverage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ asset: assetId, leverage }),
      }).catch(err => console.error(err))
    }
  },

  addBalance: (amount) => {
    set((state) => ({
      user: {
        ...state.user,
        balance: Math.min(1000, Math.max(0, state.user.balance + amount)),
        portfolioValue: Math.min(1000, Math.max(0, state.user.portfolioValue + amount)),
      },
    }))
  },

  setPositionHistory: (history) => set({ positionHistory: history }),

  applySellResult: (newBalance: number) => {
    const safeBalance = Math.max(0, newBalance)
    set((state) => ({
      allocations: { BTC: 0, GOLD: 0, EUR: 0 },
      initialPrices: createInitialPrices(),
      user: {
        ...state.user,
        balance: safeBalance,
        portfolioValue: safeBalance,
        totalPnl: 0,
        totalPnlPercent: 0,
      },
    }))
  },
}))
