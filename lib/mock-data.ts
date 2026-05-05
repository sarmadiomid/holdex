import type { Asset, User, LeaderboardEntry, StoreItem, AssetType, PrizePool } from './types'

// Initial asset data
export const initialAssets: Asset[] = [
  {
    id: 'BTC',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '₿',
    price: 67234.50,
    change24h: 2.34,
    allocation: 0,
    color: 'neon-gold'
  },
  {
    id: 'GOLD',
    name: 'Gold',
    symbol: 'XAU',
    icon: '🥇',
    price: 2341.80,
    change24h: 0.87,
    allocation: 0,
    color: 'neon-cyan'
  },
  {
    id: 'OIL',
    name: 'Crude Oil',
    symbol: 'WTI',
    icon: '🛢️',
    price: 78.45,
    change24h: -1.23,
    allocation: 0,
    color: 'neon-pink'
  }
]

// Initial user data
export const initialUser: User = {
  id: 'mock-user-001',
  username: 'trader',
  firstName: 'Demo',
  lastName: 'User',
  balance: 100,
  portfolioValue: 100,
  totalPnl: 0,
  totalPnlPercent: 0,
  leverage: 1
}

// Leaderboard mock data
export const mockLeaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    user: { id: '1', username: 'cryptoking', firstName: 'Alex', photoUrl: undefined },
    portfolioValue: 156780,
    pnl: 56780,
    pnlPercent: 56.78
  },
  {
    rank: 2,
    user: { id: '2', username: 'goldmaster', firstName: 'Sarah', photoUrl: undefined },
    portfolioValue: 134520,
    pnl: 34520,
    pnlPercent: 34.52
  },
  {
    rank: 3,
    user: { id: '3', username: 'oiltycoon', firstName: 'Mike', photoUrl: undefined },
    portfolioValue: 128900,
    pnl: 28900,
    pnlPercent: 28.90
  },
  {
    rank: 4,
    user: { id: '4', username: 'diamondhands', firstName: 'Emma', photoUrl: undefined },
    portfolioValue: 115670,
    pnl: 15670,
    pnlPercent: 15.67
  },
  {
    rank: 5,
    user: { id: '5', username: 'moonshot', firstName: 'David', photoUrl: undefined },
    portfolioValue: 112340,
    pnl: 12340,
    pnlPercent: 12.34
  },
  {
    rank: 6,
    user: { id: '6', username: 'hodler', firstName: 'Lisa', photoUrl: undefined },
    portfolioValue: 108900,
    pnl: 8900,
    pnlPercent: 8.90
  },
  {
    rank: 7,
    user: { id: '7', username: 'whale', firstName: 'James', photoUrl: undefined },
    portfolioValue: 105670,
    pnl: 5670,
    pnlPercent: 5.67
  },
  {
    rank: 8,
    user: { id: '8', username: 'bulls', firstName: 'Anna', photoUrl: undefined },
    portfolioValue: 103450,
    pnl: 3450,
    pnlPercent: 3.45
  },
  {
    rank: 9,
    user: { id: '9', username: 'bears', firstName: 'Tom', photoUrl: undefined },
    portfolioValue: 101230,
    pnl: 1230,
    pnlPercent: 1.23
  },
  {
    rank: 10,
    user: { id: '10', username: 'newbie', firstName: 'Kate', photoUrl: undefined },
    portfolioValue: 100560,
    pnl: 560,
    pnlPercent: 0.56
  }
]

// Store items (prices in Telegram Stars)
export const storeItems: StoreItem[] = [
  {
    id: 'hlx-1000',
    name: '1,000 HLX',
    description: 'Starter pack for new investors',
    starsPrice: 50,
    type: 'hlx',
    value: 1000
  },
  {
    id: 'hlx-5000',
    name: '5,000 HLX',
    description: 'Popular choice for active traders',
    starsPrice: 200,
    type: 'hlx',
    value: 5000
  },
  {
    id: 'hlx-10000',
    name: '10,000 HLX',
    description: 'Best value package',
    starsPrice: 350,
    type: 'hlx',
    value: 10000
  },
  {
    id: 'hlx-50000',
    name: '50,000 HLX',
    description: 'Whale tier investment',
    starsPrice: 1500,
    type: 'hlx',
    value: 50000
  },
  {
    id: 'leverage-2x',
    name: '2x Leverage',
    description: 'Double your gains (and losses)',
    starsPrice: 250,
    type: 'leverage',
    value: 2
  },
  {
    id: 'leverage-5x',
    name: '5x Leverage',
    description: 'High risk, high reward',
    starsPrice: 500,
    type: 'leverage',
    value: 5
  },
  {
    id: 'leverage-10x',
    name: '10x Leverage',
    description: 'Maximum power mode',
    starsPrice: 1000,
    type: 'leverage',
    value: 10
  }
]

// Prize Pool mock data — prizes in TON, weekly tournament
export const mockPrizePool: PrizePool = {
  totalTon: 500, // 500 TON total prize pool
  distribution: [
    { rank: 1, percentage: 40, tonAmount: 200 },
    { rank: 2, percentage: 25, tonAmount: 125 },
    { rank: 3, percentage: 15, tonAmount: 75 },
    { rank: 4, percentage: 10, tonAmount: 50 },
    { rank: 5, percentage: 5, tonAmount: 25 },
    { rank: 6, percentage: 3, tonAmount: 15 },
    { rank: 7, percentage: 2, tonAmount: 10 }
  ],
  endsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now (weekly)
  totalParticipants: 1247,
  season: 12
}

// Price simulation helpers
export function simulatePriceChange(currentPrice: number, volatility: number = 0.002): number {
  const change = (Math.random() - 0.5) * 2 * volatility * currentPrice
  return Math.max(0.01, currentPrice + change)
}

export function simulateChange24h(currentChange: number): number {
  const drift = (Math.random() - 0.5) * 0.3
  return Math.max(-15, Math.min(15, currentChange + drift))
}

// Generate price update
export function generatePriceUpdate(asset: Asset): Asset {
  const newPrice = simulatePriceChange(
    asset.price, 
    asset.id === 'BTC' ? 0.003 : asset.id === 'OIL' ? 0.002 : 0.001
  )
  const newChange = simulateChange24h(asset.change24h)
  
  return {
    ...asset,
    price: Number(newPrice.toFixed(2)),
    change24h: Number(newChange.toFixed(2))
  }
}

// Calculate portfolio value based on allocations
export function calculatePortfolioValue(
  balance: number,
  assets: Asset[],
  allocations: Record<AssetType, number>,
  initialPrices: Record<AssetType, number>,
  leverage: number = 1
): { value: number; pnl: number; pnlPercent: number } {
  let totalAllocated = 0
  let currentValue = 0
  
  for (const asset of assets) {
    const allocation = allocations[asset.id] || 0
    const allocatedAmount = (balance * allocation) / 100
    totalAllocated += allocation
    
    if (allocatedAmount > 0 && initialPrices[asset.id]) {
      const priceChange = (asset.price - initialPrices[asset.id]) / initialPrices[asset.id]
      const leveragedChange = priceChange * leverage
      currentValue += allocatedAmount * (1 + leveragedChange)
    }
  }
  
  // Unallocated balance remains at face value
  const unallocatedPercent = 100 - totalAllocated
  const unallocatedValue = (balance * unallocatedPercent) / 100
  currentValue += unallocatedValue
  
  const pnl = currentValue - balance
  const pnlPercent = balance > 0 ? (pnl / balance) * 100 : 0
  
  return {
    value: Number(currentValue.toFixed(2)),
    pnl: Number(pnl.toFixed(2)),
    pnlPercent: Number(pnlPercent.toFixed(2))
  }
}
