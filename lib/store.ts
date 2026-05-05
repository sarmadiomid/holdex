'use client'

import { create } from 'zustand'
import type { Asset, User, AssetType, LeaderboardEntry, Transaction, PrizePool } from './types'
import { initialAssets, mockPrizePool } from './mock-data'

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

  assets: Asset[]
  allocations: Record<AssetType, number>
  initialPrices: Record<AssetType, number | null>

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

  activeTab: 'dashboard' | 'allocate' | 'store' | 'leaderboard'

  setActiveTab: (tab: 'dashboard' | 'allocate' | 'store' | 'leaderboard') => void
  setToken: (token: string | null) => void
  setAuthenticatedUser: (userData: User, token: string) => void
  updateAssetPrice: (twelveDataSymbol: string, price: number) => void
  setUserPrices: (data: Record<string, { symbol: string; price: number; timestamp: number }>) => void
  updateUserFromSocket: (data: { portfolioValue?: number; totalPnl?: number; totalPnlPercent?: number }) => void
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
  }) => void
  setLeverage: (leverage: number) => void
  addBalance: (amount: number) => void
}

const createInitialPrices = (): Record<AssetType, number | null> => ({
  BTC: null,
  GOLD: null,
  OIL: null,
})

const TWELVE_DATA_TO_ASSET: Record<string, AssetType> = {
  'BTC/USD': 'BTC',
  'XAU/USD': 'GOLD',
  'WTI/USD': 'OIL',
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
  },
  isAuthenticated: false,
  token: null,
  assets: initialAssets,
  allocations: { BTC: 0, GOLD: 0, OIL: 0 },
  initialPrices: createInitialPrices(),
  leaderboard: [],
  leaderboardData: null,
  prizePool: mockPrizePool,
  transactions: [],
  activeTab: 'dashboard',

  setActiveTab: (tab) => set({ activeTab: tab }),

  setToken: (token) => set({ token }),

  setAuthenticatedUser: (userData, token) => set({
    user: userData,
    token,
    isAuthenticated: true,
  }),

  updateAssetPrice: (twelveDataSymbol, price) => {
    const assetId = TWELVE_DATA_TO_ASSET[twelveDataSymbol]
    if (!assetId) return

    set((state) => {
      const assetIndex = state.assets.findIndex((a) => a.id === assetId)
      if (assetIndex === -1) return state

      const updatedAssets = [...state.assets]
      const oldPrice = updatedAssets[assetIndex].price
      const change24h = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : 0
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        price,
        change24h: Math.round(change24h * 100) / 100,
      }

      return { assets: updatedAssets }
    })
  },

  setUserPrices: (data) => {
    const priceMap: Record<string, number> = {}
    const initialPrices = { ...get().initialPrices }

    for (const [symbol, item] of Object.entries(data)) {
      const assetId = TWELVE_DATA_TO_ASSET[symbol]
      if (assetId) {
        priceMap[assetId] = item.price
        if (initialPrices[assetId] === null) {
          initialPrices[assetId] = item.price
        }
      }
    }

    set((state) => {
      const updatedAssets = state.assets.map((asset) => {
        const newPrice = priceMap[asset.id]
        if (newPrice) {
          const change24h = asset.price > 0 ? ((newPrice - asset.price) / asset.price) * 100 : 0
          return { ...asset, price: newPrice, change24h: Math.round(change24h * 100) / 100 }
        }
        return asset
      })

      return { assets: updatedAssets, initialPrices }
    })
  },

  updateUserFromSocket: (data) => {
    set((state) => ({
      user: {
        ...state.user,
        ...data,
      },
    }))
  },

  setAllocations: (allocations) => set({ allocations }),

  updatePortfolioValue: () => {
    const { assets, allocations, initialPrices, user } = get()
    let totalValue = 0
    let totalAllocated = 0

    for (const asset of assets) {
      const allocation = allocations[asset.id] || 0
      const allocatedAmount = (user.balance * allocation) / 100
      totalAllocated += allocation

      if (allocatedAmount > 0 && initialPrices[asset.id]) {
        const priceChange = (asset.price - initialPrices[asset.id]!) / initialPrices[asset.id]!
        const amplifiedChange = priceChange * 500
        const leveragedChange = amplifiedChange * user.leverage
        totalValue += allocatedAmount * (1 + leveragedChange)
      }
    }

    const unallocatedPercent = 100 - totalAllocated
    totalValue += (user.balance * unallocatedPercent) / 100

    const pnl = totalValue - user.balance
    const pnlPercent = user.balance > 0 ? (pnl / user.balance) * 100 : 0

    set({
      user: {
        ...user,
        portfolioValue: Math.round(totalValue * 100) / 100,
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

    set({
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
    })
  },

  setLeverage: (leverage) => {
    set((state) => ({ user: { ...state.user, leverage } }))
  },

  addBalance: (amount) => {
    set((state) => ({
      user: {
        ...state.user,
        balance: state.user.balance + amount,
        portfolioValue: state.user.portfolioValue + amount,
      },
    }))
  },
}))
