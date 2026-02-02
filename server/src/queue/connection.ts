import IORedis from 'ioredis'
import { env } from '../lib/env'

/**
 * Redis connection factory for BullMQ
 * Creates a singleton Redis connection using REDIS_URL from environment
 */
let redisConnection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    })

    redisConnection.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    redisConnection.on('connect', () => {
      console.log('✓ Connected to Redis')
    })
  }

  return redisConnection
}

export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit()
    redisConnection = null
  }
}
