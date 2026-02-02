/**
 * Pipeline Orchestrator
 *
 * Sequences all pipeline stages (download -> analyze -> extract -> reframe -> caption -> upload)
 * with retry logic, progress reporting to DB, and cleanup on failure.
 */

import { PipelineContext, PipelineStage, PipelineConfig, PipelineError } from './types'
import type { ProcessingJob, JobStatus } from '../routes/jobs'
import { createDownloadStage } from './stages/download'
import { analyze } from './stages/analyze'
import { createExtractStage } from './stages/extract'
import { reframeStage } from './stages/reframe'
import { captionStage } from './stages/caption'
import { createUploadStage } from './stages/upload'
import path from 'path'
import { $ } from 'bun'

// Wrap analyze function in a PipelineStage
const analyzeStageWrapper: PipelineStage = {
  name: 'analyze',
  async execute(context: PipelineContext): Promise<PipelineContext> {
    if (!context.downloadedVideoPath) {
      throw new Error('Downloaded video path is required for analysis')
    }

    const result = await analyze({
      videoPath: context.downloadedVideoPath,
      vodId: context.vodId,
      viewerClips: [],
    })

    return {
      ...context,
      extractedAudioPath: result.audioPath,
      moments: result.fusedMoments,
      tempFiles: [...context.tempFiles, result.audioPath],
    }
  },
}

// Wrap caption function in a PipelineStage
const captionStageWrapper: PipelineStage = {
  name: 'caption',
  async execute(context: PipelineContext): Promise<PipelineContext> {
    const clips = context.reframedClips || []
    const outputDir = context.reframedClipsDir || context.workDir
    const captionedClips = []

    for (const clip of clips) {
      const result = await captionStage({
        videoPath: clip.path,
        outputDir,
      })

      captionedClips.push({
        path: result.outputVideoPath,
        originalPath: clip.path,
        clipId: clip.clipId,
      })
    }

    return {
      ...context,
      captionedClips,
    }
  },
}

// Pipeline stages in order
const PIPELINE_STAGES: PipelineStage[] = [
  createDownloadStage(),
  analyzeStageWrapper,
  createExtractStage(),
  reframeStage,
  captionStageWrapper,
  createUploadStage(),
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
    maxRetries: config.maxRetries ?? 0, // Retries handled by BullMQ, not orchestrator
    retryDelay: config.retryDelay ?? 0,
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
    vodTitle: job.title || '',
    userId,
    settings: job.settings || {},
    workDir,
    tempDir,
    outputDir,
    currentStage: 'queued',
    progress: 0 as number,
    tempFiles: [],
    filesToCleanup: [workDir], // Clean up entire work directory
    metadata: {},
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

    // Cleanup temporary files after successful completion
    await cleanup(context)

  } catch (error) {
    console.error(`[orchestrator] Pipeline failed for job ${job.id}:`, error)

    // Cleanup on failure
    if (cfg.cleanupOnFailure) {
      await cleanup(context)
    }

    // Report failure
    if (cfg.progressCallback) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await cfg.progressCallback(job.id, 'failed', context.progress ?? 0, message)
    }

    // Re-throw to let caller handle
    throw error
  }
}

/**
 * Execute a single stage
 * Note: Retries are handled by BullMQ at the job level, not per-stage
 */
async function executeStageWithRetry(
  context: PipelineContext,
  stage: PipelineStage,
  config: PipelineConfig
): Promise<void> {
  // Update status before stage
  const status = STAGE_TO_STATUS[stage.name] || context.currentStage
  context.currentStage = status

  console.log(`[orchestrator] Starting stage: ${stage.name}`)

  // Report stage start
  if (config.progressCallback) {
    await config.progressCallback(
      context.jobId!,
      status,
      context.progress!,
      `Starting ${stage.name}...`
    )
  }

  try {
    // Execute stage
    const result = await stage.execute(context)

    // Update context with result
    Object.assign(context, result)

    // Report stage progress
    if (config.progressCallback) {
      await config.progressCallback(
        context.jobId!,
        status,
        context.progress!,
        `${stage.name} completed`
      )
    }

    console.log(`[orchestrator] Stage ${stage.name} completed successfully`)

  } catch (error) {
    const pipelineError = error instanceof Error ? error : new Error(String(error))

    console.error(`[orchestrator] Stage ${stage.name} failed:`, pipelineError)

    // Call stage error handler if exists
    if (stage.onError) {
      try {
        await stage.onError(pipelineError, context)
      } catch (handlerError) {
        console.error(`[orchestrator] Error handler failed:`, handlerError)
      }
    }

    // Throw PipelineError for better error context
    throw new PipelineError(
      `Stage ${stage.name} failed: ${pipelineError.message}`,
      stage.name,
      context,
      pipelineError
    )
  }
}

/**
 * Cleanup temporary files and directories
 */
async function cleanup(context: PipelineContext): Promise<void> {
  const filesToCleanup = context.filesToCleanup || []
  console.log(`[orchestrator] Cleaning up ${filesToCleanup.length} files/directories`)

  for (const filePath of filesToCleanup) {
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
  return async (jobId: string, status: string, progress: number, currentStep: string) => {
    await updateJobFn(jobId, {
      status: status as JobStatus,
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
    settings: job.settings || {},
    workDir,
    tempDir,
    outputDir,
    currentStage: job.status,
    progress: job.progress,
    tempFiles: [],
    filesToCleanup: [workDir],
    metadata: {},
  }

  // Execute remaining stages
  const cfg: PipelineConfig = {
    maxRetries: config.maxRetries ?? 0, // Retries handled by BullMQ, not orchestrator
    retryDelay: config.retryDelay ?? 0,
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
      await cfg.progressCallback(job.id, 'failed', context.progress ?? 0, message)
    }

    throw error
  }
}
