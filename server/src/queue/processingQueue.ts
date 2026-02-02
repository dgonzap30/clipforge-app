import { Queue } from 'bullmq'
import { redisConnection } from './connection.js'
import type { ProcessingJob } from '../routes/jobs.js'

// Job data structure for the queue
export interface VodProcessingJobData {
  jobId: string
  vodId: string
  vodUrl: string
  title: string
  channelLogin: string
  duration: number
  settings: ProcessingJob['settings']
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
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
})

// Queue event listeners for monitoring
processingQueue.on('error', (err) => {
  console.error('Queue error:', err)
})

processingQueue.on('waiting', (job) => {
  console.log(`Job ${job.id} is waiting`)
})

processingQueue.on('active', (job) => {
  console.log(`Job ${job.id} has started`)
})

processingQueue.on('completed', (job) => {
  console.log(`Job ${job.id} has completed`)
})

processingQueue.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with error: ${err.message}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await processingQueue.close()
})

process.on('SIGINT', async () => {
  await processingQueue.close()
})
