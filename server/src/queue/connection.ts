import IORedis from 'ioredis'
import { env } from '../lib/env'

/**
 * Redis connection factory for BullMQ
 * Creates a shared Redis connection that can be reused across queues and workers
 */
export function createRedisConnection(): IORedis {
  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  })

  connection.on('error', (err) => {
    console.error('Redis connection error:', err)
  })

  connection.on('connect', () => {
    console.log('Redis connected')
  })

  return connection
}
