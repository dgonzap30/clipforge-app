import { ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import { env } from '../lib/env'

/**
 * Creates a Redis connection for BullMQ
 *
 * BullMQ requires a Redis connection to manage job queues.
 * This factory creates a connection using the REDIS_URL from environment variables.
 *
 * @returns IORedis connection for BullMQ
 */
export function createRedisConnection(): IORedis {
  // Parse Redis URL to extract connection details
  const redisUrl = new URL(env.REDIS_URL)

  const connection = new IORedis({
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    // Use the pathname as the database number (e.g., /1 -> db: 1)
    db: redisUrl.pathname ? parseInt(redisUrl.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false, // BullMQ recommendation
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3 seconds
      const delay = Math.min(times * 50, 3000)
      return delay
    },
  })

  // Log connection events in development
  if (process.env.NODE_ENV !== 'production') {
    connection.on('connect', () => {
      console.log('Redis connected')
    })

    connection.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    connection.on('ready', () => {
      console.log('Redis ready')
    })
  }

  return connection
}

/**
 * Export a singleton connection instance for reuse across queues
 */
export const redisConnection = createRedisConnection()
