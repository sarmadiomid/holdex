import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  telegramId: number
  username?: string
  firstName: string
  lastName?: string
  photoUrl?: string
  balance: number
  allocations: {
    BTC: number
    GOLD: number
    OIL: number
  }
  initialPrices: {
    BTC: number | null
    GOLD: number | null
    OIL: number | null
  }
  leverage: number
  portfolioValue: number
  totalPnl: number
  totalPnlPercent: number
  referrerId?: mongoose.Types.ObjectId
  referredUsers: mongoose.Types.ObjectId[]
  weekStart: Date
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String },
    firstName: { type: String, required: true, default: 'User' },
    lastName: { type: String },
    photoUrl: { type: String },
    balance: { type: Number, required: true, default: 100 },
    allocations: {
      BTC: { type: Number, required: true, default: 0 },
      GOLD: { type: Number, required: true, default: 0 },
      OIL: { type: Number, required: true, default: 0 },
    },
    initialPrices: {
      BTC: { type: Number, default: null },
      GOLD: { type: Number, default: null },
      OIL: { type: Number, default: null },
    },
    leverage: { type: Number, required: true, default: 1 },
    portfolioValue: { type: Number, required: true, default: 100 },
    totalPnl: { type: Number, required: true, default: 0 },
    totalPnlPercent: { type: Number, required: true, default: 0 },
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    referredUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    weekStart: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
)

UserSchema.index({ totalPnlPercent: -1 })
UserSchema.index({ weekStart: -1, totalPnlPercent: -1 })

export const User = mongoose.model<IUser>('User', UserSchema)
