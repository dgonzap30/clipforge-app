import { Worker, Job } from 'bullmq'
import { redisConnection } from './connection'
import { runPipeline } from '../pipeline/orchestrator'
import type { VodProcessingJobData } from './processingQueue'

/**
 * BullMQ Worker for processing VOD jobs
 * - Concurrency: 1 (process one job at a time to avoid resource contention)
 * - Calls runPipeline from orchestrator for each job
 * - Handles job completion and failure states
 */
export const vodWorker = new Worker<VodProcessingJobData>(
  'vod-processing',
  async (job: Job<VodProcessingJobData>) => {
    const { jobId } = job.data

    console.log(`[Worker] Processing job ${jobId} (BullMQ job ID: ${job.id})`)

    try {
      // Run the pipeline orchestrator
      const result = await runPipeline(jobId)

      if (result.success) {
        console.log(`[Worker] Job ${jobId} completed successfully. Clips generated: ${result.clipIds.length}`)
        return result
      } else {
        console.error(`[Worker] Job ${jobId} failed: ${result.error}`)
        throw new Error(result.error || 'Pipeline failed')
      }
    } catch (error) {
      console.error(`[Worker] Error processing job ${jobId}:`, error)
      throw error // Re-throw to mark BullMQ job as failed
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one job at a time
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  }
)

// Worker event handlers
vodWorker.on('completed', (job) => {
  console.log(`[Worker] ✓ Job ${job.id} completed`)
})

vodWorker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ Job ${job?.id} failed:`, err.message)
})

vodWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err)
})

vodWorker.on('ready', () => {
  console.log('[Worker] Worker is ready to process jobs')
})

// Graceful shutdown handler
export async function closeWorker() {
  console.log('[Worker] Shutting down worker...')
  await vodWorker.close()
  console.log('[Worker] Worker closed')
}
