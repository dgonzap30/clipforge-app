import { Queue } from 'bullmq'
import { redisConnection } from './connection'

export interface VodProcessingJobData {
  jobId: string
}

// Create BullMQ Queue for VOD processing
export const processingQueue = new Queue<VodProcessingJobData>('vod-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 7 * 24 * 60 * 60, // 7 days
    },
    removeOnFail: {
      count: 100, // Keep last 100 failed jobs
      age: 30 * 24 * 60 * 60, // 30 days
    },
  },
})
