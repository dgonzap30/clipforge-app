import { Worker, Job } from 'bullmq'
import { redisConnection } from './connection'
import { runPipeline } from '../pipeline/orchestrator'
import { supabase } from '../lib/supabase'
import type { VodProcessingJobData } from './processingQueue'
import type { ProcessingJob } from '../routes/jobs'

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
      // Fetch job from database
      const { data: jobRow, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (fetchError || !jobRow) {
        const errorMessage = `Failed to fetch job ${jobId}: ${fetchError?.message || 'Job not found'}`

        // Update DB status before throwing (if we can identify the jobId)
        try {
          await supabase.from('jobs').update({
            status: 'failed',
            error: errorMessage,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', jobId)
        } catch (updateError) {
          console.error(`[Worker] Failed to update job status for ${jobId}:`, updateError)
        }

        throw new Error(errorMessage)
      }

      // Convert snake_case to camelCase for ProcessingJob
      const processingJob: ProcessingJob = {
        id: jobRow.id,
        user_id: jobRow.user_id,
        vodId: jobRow.vod_id,
        twitchVodId: jobRow.twitch_vod_id,
        vodUrl: jobRow.vod_url,
        title: jobRow.title,
        channelLogin: jobRow.channel_login,
        duration: jobRow.vod_duration,
        status: jobRow.status,
        progress: jobRow.progress,
        currentStep: jobRow.current_step,
        clipsFound: jobRow.clips_found,
        error: jobRow.error,
        createdAt: jobRow.created_at,
        updatedAt: jobRow.updated_at,
        completedAt: jobRow.completed_at,
        settings: jobRow.settings,
      }

      // Run the pipeline orchestrator with progress callback
      await runPipeline(processingJob, jobRow.user_id, {
        progressCallback: async (jobId, status, progress, message) => {
          await supabase.from('jobs').update({
            status,
            progress,
            current_step: message,
            updated_at: new Date().toISOString(),
          }).eq('id', jobId)
        }
      })

      console.log(`[Worker] Job ${jobId} completed successfully`)
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
