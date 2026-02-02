import { Worker, Job } from 'bullmq'
import { getRedisConnection } from './connection'
import type { ProcessingJobData } from './processingQueue'

/**
 * BullMQ Worker for processing VOD jobs
 * Processes jobs from 'vod-processing' queue with concurrency 1
 *
 * NOTE: This worker currently logs job processing.
 * The actual pipeline implementation (runPipeline from orchestrator.ts)
 * will be integrated when the pipeline stages are ready.
 */
export const worker = new Worker<ProcessingJobData>(
  'vod-processing',
  async (job: Job<ProcessingJobData>) => {
    console.log(`Processing job ${job.id} for jobId: ${job.data.jobId}`)

    // TODO: Call runPipeline from orchestrator when pipeline is implemented
    // For now, just log that we received the job
    // await runPipeline(job.data.jobId)

    console.log(`Job ${job.id} completed`)
  },
  {
    connection: getRedisConnection(),
    concurrency: 1, // Process one job at a time
  }
)

worker.on('ready', () => {
  console.log('✓ Worker ready and waiting for jobs')
})

worker.on('active', (job: Job) => {
  console.log(`Worker started job ${job.id}`)
})

worker.on('completed', (job: Job) => {
  console.log(`Worker completed job ${job.id}`)
})

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`Worker failed job ${job?.id}:`, err)
})

worker.on('error', (err: Error) => {
  console.error('Worker error:', err)
})

export async function stopWorker(): Promise<void> {
  console.log('Stopping worker...')
  await worker.close()
  console.log('Worker stopped')
}
