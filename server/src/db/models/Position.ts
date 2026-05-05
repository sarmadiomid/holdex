import mongoose, { Schema, Document } from 'mongoose'

export interface IPosition extends Document {
  userId: mongoose.Types.ObjectId
  type: 'buy' | 'sell' | 'allocate' | 'store_purchase'
  asset?: 'BTC' | 'GOLD' | 'OIL'
  amount: number
  hlxValue: number
  priceAtTime?: number
  createdAt: Date
}

const PositionSchema = new Schema<IPosition>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['buy', 'sell', 'allocate', 'store_purchase'],
      required: true,
    },
    asset: { type: String, enum: ['BTC', 'GOLD', 'OIL'] },
    amount: { type: Number, required: true },
    hlxValue: { type: Number, required: true },
    priceAtTime: { type: Number },
  },
  { timestamps: true },
)

PositionSchema.index({ userId: 1, createdAt: -1 })

export const Position = mongoose.model<IPosition>('Position', PositionSchema)
