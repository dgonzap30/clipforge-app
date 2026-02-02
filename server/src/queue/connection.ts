import Redis from 'ioredis'
import { env } from '../lib/env.js'

// Create Redis connection for BullMQ
// BullMQ uses ioredis under the hood
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
})

// Handle connection events
redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redisConnection.on('connect', () => {
  console.log('Redis connected successfully')
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redisConnection.quit()
})

process.on('SIGINT', async () => {
  await redisConnection.quit()
})
