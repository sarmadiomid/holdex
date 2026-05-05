const VOLATILITY_MULTIPLIER: Record<string, number> = {
  BTC: 150,
  GOLD: 80,
  OIL: 120,
}

interface Allocations {
  BTC: number
  GOLD: number
  OIL: number
}

interface PortfolioResult {
  value: number
  pnl: number
  pnlPercent: number
}

export function calculatePortfolioValue(
  balance: number,
  allocations: Allocations,
  initialPrices: Record<string, number>,
  currentPrices: Record<string, number>,
  leverage: number,
): PortfolioResult {
  let totalValue = 0

  for (const asset of ['BTC', 'GOLD', 'OIL'] as const) {
    const allocPercent = allocations[asset] / 100
    if (allocPercent <= 0) continue

    const allocatedAmount = balance * allocPercent
    const initialPrice = initialPrices[asset]
    const currentPrice = currentPrices[asset]

    if (!initialPrice || !currentPrice || initialPrice === 0) {
      totalValue += allocatedAmount
      continue
    }

    const priceChange = (currentPrice - initialPrice) / initialPrice
    const multiplier = VOLATILITY_MULTIPLIER[asset] || 1
    const amplifiedChange = priceChange * multiplier
    const leveragedChange = amplifiedChange * leverage
    const assetValue = allocatedAmount * (1 + leveragedChange)
    totalValue += assetValue
  }

  const unallocatedPercent =
    1 - (allocations.BTC + allocations.GOLD + allocations.OIL) / 100
  if (unallocatedPercent > 0) {
    totalValue += balance * unallocatedPercent
  }

  const pnl = totalValue - balance
  const pnlPercent = balance > 0 ? (pnl / balance) * 100 : 0

  return {
    value: Math.round(totalValue * 100) / 100,
    pnl: Math.round(pnl * 100) / 100,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
  }
}

export function validateAllocations(allocations: Partial<Allocations>): {
  valid: boolean
  error?: string
  total?: number
} {
  const btc = allocations.BTC ?? 0
  const gold = allocations.GOLD ?? 0
  const oil = allocations.OIL ?? 0

  const total = btc + gold + oil

  if (total < 0) {
    return { valid: false, error: 'Allocations cannot be negative' }
  }

  if (total > 100) {
    return { valid: false, error: 'Total allocation cannot exceed 100%' }
  }

  for (const [asset, value] of Object.entries(allocations)) {
    if (value! < 0 || value! > 100) {
      return { valid: false, error: `${asset} allocation must be between 0 and 100` }
    }
  }

  return { valid: true, total }
}
