import { io, Socket } from 'socket.io-client'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (socket && (socket as any).auth?.token === token && socket.connected) {
    return socket
  }

  if (socket) {
    socket.disconnect()
  }

  socket = io(BACKEND_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export interface PriceUpdateEvent {
  symbol: string
  price: number
  timestamp: number
}

export interface PricesSnapshotEvent {
  [symbol: string]: {
    symbol: string
    price: number
    timestamp: number
  }
}

export interface UserUpdateEvent {
  portfolioValue?: number
  totalPnl?: number
  totalPnlPercent?: number
  balance?: number
  allocations?: { BTC: number; GOLD: number; EUR: number }
  leverage?: number
}

export interface AllocationUpdateEvent {
  telegramId: number
  allocations: { BTC: number; GOLD: number; EUR: number }
}
