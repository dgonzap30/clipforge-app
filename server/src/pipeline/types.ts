/**
 * Pipeline Types
 *
 * Core types for the video processing pipeline.
 * Each stage receives context and returns updated context.
 */

import { SignalMoment } from '../analysis/fusion'
import { ProcessingJob } from '../routes/jobs'

export interface PipelineContext {
  // Job metadata
  job: ProcessingJob

  // Working directory for this job
  workDir: string

  // VOD information
  vodUrl: string
  vodTitle: string

  // File paths (populated as pipeline progresses)
  downloadedVideoPath?: string
  extractedAudioPath?: string

  // Analysis results
  moments?: SignalMoment[]

  // Extracted clips
  clipPaths?: string[]
  clipIds?: string[]

  // Temporary files to clean up
  tempFiles: string[]

  // Error tracking
  error?: string

  // Custom data for stages to share state
  metadata: Record<string, any>
}

export interface PipelineStage {
  // Stage identifier
  name: string

  // Execute the stage
  execute(context: PipelineContext): Promise<PipelineContext>

  // Optional: validate that this stage can run
  validate?(context: PipelineContext): Promise<boolean>

  // Optional: cleanup on failure
  cleanup?(context: PipelineContext): Promise<void>
}

export interface ProgressCallback {
  (progress: number, status: string, details?: any): void
}

export interface DownloadProgress {
  percent: number
  downloadedBytes: number
  totalBytes: number
  speed: string
  eta: string
}

export interface StageProgress {
  stage: string
  percent: number
  status: string
  details?: any
}
