import IORedis from 'ioredis'
import { env } from '../lib/env'

// Create Redis connection for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
})

// Graceful shutdown handler
export async function closeRedisConnection() {
  await redisConnection.quit()
}
