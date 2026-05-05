import dotenv from 'dotenv'
dotenv.config({ path: ['.env.local', '.env'] })
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  MONGODB_URI: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  TWELVE_DATA_API_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
})

export type Env = z.infer<typeof envSchema>

export const env: Env = envSchema.parse(process.env)
