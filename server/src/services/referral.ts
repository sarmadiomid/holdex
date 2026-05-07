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

  // Add referral reward to referrer
  referrer.balance += REFERRAL_REWARD
  referrer.portfolioValue += REFERRAL_REWARD
  referrer.referredUsers.push(newUser._id as mongoose.Types.ObjectId)

  let inviteTaskCompleted = false

  // Check if invite-5 task should be completed
  const completedTasks = referrer.completedTasks || []
  const referralCount = referrer.referredUsers.length

  if (referralCount >= INVITE_TASK_REQUIRED && !completedTasks.includes(INVITE_TASK_ID)) {
    referrer.balance += INVITE_TASK_REWARD
    referrer.portfolioValue += INVITE_TASK_REWARD
    referrer.completedTasks = [...completedTasks, INVITE_TASK_ID]
    inviteTaskCompleted = true

    // Create position record for invite task reward
    await Position.create({
      userId: referrer._id,
      type: 'store_purchase',
      amount: 0,
      hlxValue: INVITE_TASK_REWARD,
    })

    logger.info(
      `Invite-5 task completed by user ${referrer.telegramId}, reward: ${INVITE_TASK_REWARD} HLX`,
    )
  }

  await referrer.save()

  // Set referrer on new user
  newUser.referrerId = referrer._id as mongoose.Types.ObjectId
  await newUser.save()

  // Create position record for referral reward
  await Position.create({
    userId: referrer._id,
    type: 'store_purchase',
    amount: 0,
    hlxValue: REFERRAL_REWARD,
  })

  logger.info(
    `Referral reward: ${REFERRAL_REWARD} HLX to user ${referrer.telegramId} for referring ${newUser.telegramId}`,
  )

  return { inviteTaskCompleted, newBalance: referrer.balance }
}
