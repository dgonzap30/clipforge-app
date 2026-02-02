/**
 * Pipeline Types
 *
 * Defines the interfaces for the processing pipeline that orchestrates
 * all stages from download to upload.
 */

import type { ProcessingJob, JobStatus } from '../routes/jobs'

export interface PipelineContext {
  // Job metadata
  jobId: string
  vodId: string
  vodUrl: string
  userId: string

  // Job settings
  settings: ProcessingJob['settings']

  // Working directories
  workDir: string
  tempDir: string
  outputDir: string

  // File paths (populated as pipeline progresses)
  vodPath?: string
  audioPath?: string
  clipPaths?: string[]
  reframedPaths?: string[]
  captionedPaths?: string[]
  uploadedUrls?: string[]

  // Analysis results
  analysisResults?: {
    audioMoments?: any[]
    chatMoments?: any[]
    fusedMoments?: any[]
    clipsFound: number
  }

  // Progress tracking
  currentStage: JobStatus
  progress: number

  // Cleanup tracking
  filesToCleanup: string[]
}

export interface PipelineStage {
  name: string
  execute: (ctx: PipelineContext) => Promise<PipelineContext>
  onError?: (ctx: PipelineContext, error: Error) => Promise<void>
  retryable?: boolean
  maxRetries?: number
}

export interface PipelineConfig {
  maxRetries: number
  retryDelay: number // milliseconds
  cleanupOnFailure: boolean
  progressCallback?: (jobId: string, status: JobStatus, progress: number, currentStep: string) => Promise<void>
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public stage: string,
    public context: PipelineContext,
    public cause?: Error
  ) {
    super(message)
    this.name = 'PipelineError'
  }
}
