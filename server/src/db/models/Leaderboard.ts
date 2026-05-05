import mongoose, { Schema, Document } from 'mongoose'

export interface ILeaderboardEntry extends Document {
  userId: mongoose.Types.ObjectId
  telegramId: number
  username: string
  firstName: string
  photoUrl?: string
  portfolioValue: number
  pnl: number
  pnlPercent: number
  rank: number
  season: number
  weekStart: Date
  weekEnd: Date
  prizeTon?: number
}

const LeaderboardEntrySchema = new Schema<ILeaderboardEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  telegramId: { type: Number, required: true, index: true },
  username: { type: String, required: true },
  firstName: { type: String, required: true },
  photoUrl: { type: String },
  portfolioValue: { type: Number, required: true },
  pnl: { type: Number, required: true },
  pnlPercent: { type: Number, required: true },
  rank: { type: Number, required: true },
  season: { type: Number, required: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  prizeTon: { type: Number },
})

LeaderboardEntrySchema.index({ season: 1, rank: 1 })
LeaderboardEntrySchema.index({ weekStart: -1 })

export const LeaderboardEntry = mongoose.model<ILeaderboardEntry>(
  'LeaderboardEntry',
  LeaderboardEntrySchema,
)
