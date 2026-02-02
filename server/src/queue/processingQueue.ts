import { Queue } from 'bullmq'
import { getRedisConnection } from './connection'

export interface ProcessingJobData {
  jobId: string
}

/**
 * BullMQ Queue for VOD processing jobs
 * Uses Redis connection from connection.ts
 */
export const processingQueue = new Queue<ProcessingJobData>('vod-processing', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
    },
  },
})

processingQueue.on('error', (err) => {
  console.error('Processing queue error:', err)
})
