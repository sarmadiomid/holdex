import mongoose from 'mongoose'
import { env } from '../config/env'
import { logger } from '../utils/logger'

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    })
    logger.info('MongoDB Atlas connected')
  } catch (error: any) {
    logger.error(`MongoDB connection failed: ${error.message}`)
    logger.error('Fix: Whitelist your IP in MongoDB Atlas Network Access (0.0.0.0/0 for all IPs)')
    process.exit(1)
  }
}
