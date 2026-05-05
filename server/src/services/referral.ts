import { User, IUser } from '../db/models/User'
import { logger } from '../utils/logger'
import mongoose from 'mongoose'

const REFERRAL_REWARD = 10

export async function processReferral(
  newUser: IUser,
  referrerTelegramId: number,
): Promise<void> {
  if (!referrerTelegramId) return

  const referrer = await User.findOne({ telegramId: referrerTelegramId })

  if (!referrer) {
    logger.warn(`Referrer not found: telegramId=${referrerTelegramId}`)
    return
  }

  if (referrer.telegramId === newUser.telegramId) {
    logger.warn('Self-referral attempt blocked')
    return
  }

  if (referrer.referredUsers.some((id) => id.equals(newUser._id as mongoose.Types.ObjectId))) {
    logger.warn('Duplicate referral blocked')
    return
  }

  referrer.balance += REFERRAL_REWARD
  referrer.referredUsers.push(newUser._id as mongoose.Types.ObjectId)
  await referrer.save()

  logger.info(
    `Referral reward: ${REFERRAL_REWARD} HLX to user ${referrer.telegramId} for referring ${newUser.telegramId}`,
  )
}
