import { Router } from 'express'
import { z } from 'zod'
import { User } from '../db/models/User'
import { Position } from '../db/models/Position'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logger } from '../utils/logger'

const router = Router()

const completeTaskSchema = z.object({
  taskId: z.string(),
})

const TASK_REWARDS: Record<string, number> = {
  'follow-twitter': 500,
  'follow-telegram': 500,
  'watch-tutorial': 300,
  'visit-website': 200,
  'share-app': 1000,
  'invite-5': 2500,
  'follow-instagram': 500,
  'watch-demo': 300,
}

router.post(
  '/complete',
  authMiddleware,
  validate(completeTaskSchema),
  async (req: AuthRequest, res) => {
    try {
      const { telegramId } = req
      const { taskId } = req.body as { taskId: string }

      const reward = TASK_REWARDS[taskId]
      if (!reward) {
        return res.status(400).json({ error: 'Invalid task' })
      }

      const user = await User.findOne({ telegramId })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if task already completed
      if (user.completedTasks && user.completedTasks.includes(taskId)) {
        return res.status(400).json({ error: 'Task already completed' })
      }

      // Add reward to balance and mark task as completed
      user.balance += reward
      user.portfolioValue += reward
      if (!user.completedTasks) {
        user.completedTasks = []
      }
      user.completedTasks.push(taskId)
      await user.save()

      // Create position record for task completion
      await Position.create({
        userId: user._id,
        type: 'store_purchase',
        amount: 0,
        hlxValue: reward,
      })

      logger.info(`Task ${taskId} completed by user ${telegramId}, reward: ${reward}`)

      res.json({
        success: true,
        reward,
        newBalance: user.balance,
        newPortfolioValue: user.portfolioValue,
      })
    } catch (error) {
      logger.error('Task completion error', { error })
      res.status(500).json({ error: 'Failed to complete task' })
    }
  },
)

router.get('/tasks', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { telegramId } = req

    const user = await User.findOne({ telegramId })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const completedTaskIds = user.completedTasks || []

    const tasks = Object.entries(TASK_REWARDS).map(([taskId, reward]) => ({
      taskId,
      reward,
      completed: completedTaskIds.includes(taskId),
    }))

    res.json({ tasks })
  } catch (error) {
    logger.error('Get tasks error', { error })
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

export default router
