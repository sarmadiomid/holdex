import mongoose, { Schema, Document } from 'mongoose'

export interface IPosition extends Document {
  userId: mongoose.Types.ObjectId
  type: 'buy' | 'sell' | 'allocate' | 'store_purchase'
  asset?: 'BTC' | 'GOLD' | 'EUR'
  amount: number
  hlxValue: number
  pnl?: number
  priceAtTime?: number
  createdAt: Date
}

const PositionSchema = new Schema<IPosition>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['buy', 'sell', 'allocate', 'store_purchase', 'reward'],
      required: true,
    },
    asset: { type: String, enum: ['BTC', 'GOLD', 'EUR'] },
    amount: { type: Number, required: true },
    hlxValue: { type: Number, required: true },
    pnl: { type: Number },
    priceAtTime: { type: Number },
  },
  { timestamps: true },
)

PositionSchema.index({ userId: 1, createdAt: -1 })

export const Position = mongoose.model<IPosition>('Position', PositionSchema)
