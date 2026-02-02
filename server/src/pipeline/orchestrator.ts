/**
 * Pipeline Orchestrator
 *
 * Sequences all pipeline stages (download -> analyze -> extract -> reframe -> caption -> upload)
 * with retry logic, progress reporting to DB, and cleanup on failure.
 */

import { PipelineContext, PipelineStage, PipelineConfig, PipelineError } from './types'
import type { ProcessingJob, JobStatus } from '../routes/jobs'
import { downloadStage } from './stages/download'
import { analyzeStage } from './stages/analyze'
import { extractStage } from './stages/extract'
import { reframeStage } from './stages/reframe'
import { captionStage } from './stages/caption'
import { uploadStage } from './stages/upload'
import { nanoid } from 'nanoid'
import path from 'path'
import { $ } from 'bun'

// Pipeline stages in order
const PIPELINE_STAGES: PipelineStage[] = [
  downloadStage,
  analyzeStage,
  extractStage,
  reframeStage,
  captionStage,
  uploadStage,
]

// Map stage names to job statuses
const STAGE_TO_STATUS: Record<string, JobStatus> = {
  'download': 'downloading',
  'analyze': 'analyzing',
  'extract': 'extracting',
  'reframe': 'reframing',
  'caption': 'captioning',
  'upload': 'completed',
}

/**
 * Run the complete pipeline for a VOD processing job
 */
export async function runPipeline(
  job: ProcessingJob,
  userId: string,
  config: Partial<PipelineConfig> = {}
): Promise<void> {
  const cfg: PipelineConfig = {
    maxRetries: config.maxRetries ?? 3,
    retryDelay: config.retryDelay ?? 5000,
    cleanupOnFailure: config.cleanupOnFailure ?? true,
    progressCallback: config.progressCallback,
  }

  // Initialize pipeline context
  const workDir = path.join('/tmp', 'clipforge', job.id)
  const tempDir = path.join(workDir, 'temp')
  const outputDir = path.join(workDir, 'output')

  // Create working directories
  await $`mkdir -p ${workDir} ${tempDir} ${outputDir}`.quiet()

  const context: PipelineContext = {
    jobId: job.id,
    vodId: job.vodId,
    vodUrl: job.vodUrl,
    userId,
    settings: job.settings,
    workDir,
    tempDir,
    outputDir,
    currentStage: 'queued',
    progress: 0,
    filesToCleanup: [workDir], // Clean up entire work directory
  }

  try {
    console.log(`[orchestrator] Starting pipeline for job ${job.id}`)

    // Execute each stage in sequence
    for (const stage of PIPELINE_STAGES) {
      await executeStageWithRetry(context, stage, cfg)
    }

    console.log(`[orchestrator] Pipeline completed successfully for job ${job.id}`)

    // Report final completion
    if (cfg.progressCallback) {
      await cfg.progressCallback(job.id, 'completed', 100, 'Processing complete')
    }

  } catch (error) {
    console.error(`[orchestrator] Pipeline failed for job ${job.id}:`, error)

    // Cleanup on failure
    if (cfg.cleanupOnFailure) {
      await cleanup(context)
    }

    // Report failure
    if (cfg.progressCallback) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await cfg.progressCallback(job.id, 'failed', context.progress, message)
    }

    // Re-throw to let caller handle
    throw error
  }
}

/**
 * Execute a single stage with retry logic
 */
async function executeStageWithRetry(
  context: PipelineContext,
  stage: PipelineStage,
  config: PipelineConfig
): Promise<void> {
  const maxRetries = stage.retryable ? (stage.maxRetries ?? config.maxRetries) : 0
  let lastError: Error | undefined

  // Update status before stage
  const status = STAGE_TO_STATUS[stage.name] || context.currentStage
  context.currentStage = status

  console.log(`[orchestrator] Starting stage: ${stage.name}`)

  // Report stage start
  if (config.progressCallback) {
    await config.progressCallback(
      context.jobId,
      status,
      context.progress,
      `Starting ${stage.name}...`
    )
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute stage
      const result = await stage.execute(context)

      // Update context with result
      Object.assign(context, result)

      // Report stage progress
      if (config.progressCallback) {
        await config.progressCallback(
          context.jobId,
          status,
          context.progress,
          `${stage.name} completed`
        )
      }

      console.log(`[orchestrator] Stage ${stage.name} completed successfully`)
      return

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      console.error(
        `[orchestrator] Stage ${stage.name} failed (attempt ${attempt + 1}/${maxRetries + 1}):`,
        lastError
      )

      // Call stage error handler if exists
      if (stage.onError) {
        try {
          await stage.onError(context, lastError)
        } catch (handlerError) {
          console.error(`[orchestrator] Error handler failed:`, handlerError)
        }
      }

      // If we have retries left, wait and retry
      if (attempt < maxRetries) {
        const delay = config.retryDelay * (attempt + 1) // Exponential backoff
        console.log(`[orchestrator] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries exhausted
  throw new PipelineError(
    `Stage ${stage.name} failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
    stage.name,
    context,
    lastError
  )
}

/**
 * Cleanup temporary files and directories
 */
async function cleanup(context: PipelineContext): Promise<void> {
  console.log(`[orchestrator] Cleaning up ${context.filesToCleanup.length} files/directories`)

  for (const filePath of context.filesToCleanup) {
    try {
      // Check if file/directory exists
      const exists = await Bun.file(filePath).exists() || await directoryExists(filePath)

      if (exists) {
        await $`rm -rf ${filePath}`.quiet()
        console.log(`[orchestrator] Deleted: ${filePath}`)
      }
    } catch (error) {
      console.warn(`[orchestrator] Failed to delete ${filePath}:`, error)
    }
  }

  console.log('[orchestrator] Cleanup complete')
}

/**
 * Check if directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const result = await $`test -d ${dirPath}`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

/**
 * Create a progress callback that updates job status in database
 */
export function createDatabaseProgressCallback(
  updateJobFn: (jobId: string, updates: Partial<ProcessingJob>) => Promise<void>
): PipelineConfig['progressCallback'] {
  return async (jobId: string, status: JobStatus, progress: number, currentStep: string) => {
    await updateJobFn(jobId, {
      status,
      progress,
      currentStep,
      updatedAt: new Date().toISOString(),
    })
  }
}

/**
 * Resume a failed pipeline from a specific stage
 * Useful for retry logic in job queue
 */
export async function resumePipeline(
  job: ProcessingJob,
  userId: string,
  fromStage: string,
  config: Partial<PipelineConfig> = {}
): Promise<void> {
  // Find stage index
  const stageIndex = PIPELINE_STAGES.findIndex(s => s.name === fromStage)

  if (stageIndex === -1) {
    throw new Error(`Invalid stage name: ${fromStage}`)
  }

  // Create a modified pipeline starting from the specified stage
  const resumeStages = PIPELINE_STAGES.slice(stageIndex)

  console.log(`[orchestrator] Resuming pipeline from stage: ${fromStage}`)

  // Re-initialize context (in production, you'd load saved context from DB)
  const workDir = path.join('/tmp', 'clipforge', job.id)
  const tempDir = path.join(workDir, 'temp')
  const outputDir = path.join(workDir, 'output')

  const context: PipelineContext = {
    jobId: job.id,
    vodId: job.vodId,
    vodUrl: job.vodUrl,
    userId,
    settings: job.settings,
    workDir,
    tempDir,
    outputDir,
    currentStage: job.status,
    progress: job.progress,
    filesToCleanup: [workDir],
  }

  // Execute remaining stages
  const cfg: PipelineConfig = {
    maxRetries: config.maxRetries ?? 3,
    retryDelay: config.retryDelay ?? 5000,
    cleanupOnFailure: config.cleanupOnFailure ?? true,
    progressCallback: config.progressCallback,
  }

  try {
    for (const stage of resumeStages) {
      await executeStageWithRetry(context, stage, cfg)
    }

    if (cfg.progressCallback) {
      await cfg.progressCallback(job.id, 'completed', 100, 'Processing complete')
    }

  } catch (error) {
    if (cfg.cleanupOnFailure) {
      await cleanup(context)
    }

    if (cfg.progressCallback) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await cfg.progressCallback(job.id, 'failed', context.progress, message)
    }

    throw error
  }
}
