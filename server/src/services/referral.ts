import { User, IUser } from '../db/models/User'
import { Position } from '../db/models/Position'
import { logger } from '../utils/logger'
import mongoose from 'mongoose'

const REFERRAL_REWARD = 10
const INVITE_TASK_ID = 'invite-5'
const INVITE_TASK_REWARD = 2500
const INVITE_TASK_REQUIRED = 5

export async function processReferral(
  newUser: IUser,
  referrerTelegramId: number,
): Promise<{ inviteTaskCompleted: boolean; newBalance: number }> {
  if (!referrerTelegramId) return { inviteTaskCompleted: false, newBalance: 0 }

  const referrer = await User.findOne({ telegramId: referrerTelegramId })

  if (!referrer) {
    logger.warn(`Referrer not found: telegramId=${referrerTelegramId}`)
    return { inviteTaskCompleted: false, newBalance: 0 }
  }

  if (referrer.telegramId === newUser.telegramId) {
    logger.warn('Self-referral attempt blocked')
    return { inviteTaskCompleted: false, newBalance: 0 }
  }

  if (referrer.referredUsers.some((id) => id.equals(newUser._id as mongoose.Types.ObjectId))) {
    logger.warn('Duplicate referral blocked')
    return { inviteTaskCompleted: false, newBalance: 0 }
  }

  // Use transaction to ensure atomicity of referrer update + new user update + position creation
  const session = await mongoose.startSession()
  let inviteTaskCompleted = false
  let newBalance = 0

  try {
    await session.withTransaction(async () => {
      // Add referral reward to referrer
      referrer.balance += REFERRAL_REWARD
      referrer.portfolioValue += REFERRAL_REWARD
      referrer.referredUsers.push(newUser._id as mongoose.Types.ObjectId)

      // Check if invite-5 task should be completed
      const completedTasks = referrer.completedTasks || []
      const referralCount = referrer.referredUsers.length

      const positionsToCreate: any[] = []

      if (referralCount >= INVITE_TASK_REQUIRED && !completedTasks.includes(INVITE_TASK_ID)) {
        referrer.balance += INVITE_TASK_REWARD
        referrer.portfolioValue += INVITE_TASK_REWARD
        referrer.completedTasks = [...completedTasks, INVITE_TASK_ID]
        inviteTaskCompleted = true

        // Add position record for invite task reward
        positionsToCreate.push({
          userId: referrer._id,
          type: 'store_purchase',
          amount: 0,
          hlxValue: INVITE_TASK_REWARD,
        })

        logger.info(
          `Invite-5 task completed by user ${referrer.telegramId}, reward: ${INVITE_TASK_REWARD} HLX`,
        )
      }

      await referrer.save({ session })

      // Set referrer on new user
      newUser.referrerId = referrer._id as mongoose.Types.ObjectId
      await newUser.save({ session })

      // Add position record for referral reward
      positionsToCreate.push({
        userId: referrer._id,
        type: 'store_purchase',
        amount: 0,
        hlxValue: REFERRAL_REWARD,
      })

      // Create all position records
      if (positionsToCreate.length > 0) {
        await Position.create(positionsToCreate, { session })
      }

      newBalance = referrer.balance

      logger.info(
        `Referral reward: ${REFERRAL_REWARD} HLX to user ${referrer.telegramId} for referring ${newUser.telegramId}`,
      )
    })
  } finally {
    await session.endSession()
  }

  return { inviteTaskCompleted, newBalance }
}
