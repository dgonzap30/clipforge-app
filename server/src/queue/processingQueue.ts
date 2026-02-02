import { Queue } from 'bullmq'
import { createRedisConnection } from './connection'

/**
 * Job data structure for VOD processing
 */
export interface ProcessVodJobData {
  jobId: string
}

/**
 * BullMQ Queue for VOD processing
 * Jobs added to this queue will be picked up by workers for processing
 */
export const processingQueue = new Queue<ProcessVodJobData>('vod-processing', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
})

// Graceful shutdown
processingQueue.on('error', (err) => {
  console.error('Processing queue error:', err)
})
