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
  job?: ProcessingJob
  jobId?: string
  vodId?: string
  userId?: string

  // Working directory for this job
  workDir: string
  tempDir?: string
  outputDir?: string

  // VOD information
  vodUrl: string
  vodTitle?: string
  vodPath?: string

  // File paths (populated as pipeline progresses)
  downloadedVideoPath?: string
  extractedAudioPath?: string

  // Analysis results
  moments?: SignalMoment[]

  // Extracted clips
  clipPaths?: string[]
  clipIds?: string[]
  extractedClips?: Array<{ path: string; startTime: number; endTime: number; clipId?: string }>
  extractedClipsDir?: string
  reframedClips?: Array<{ path: string; originalPath: string; clipId?: string }>
  reframedClipsDir?: string
  effectsClips?: Array<{ path: string; originalPath: string; clipId?: string }>
  effectsClipsDir?: string
  captionedClips?: Array<{ path: string; originalPath: string; clipId?: string }>
  compiledClipPath?: string
  uploadedClips?: Array<{
    clipId: string
    videoPath: string
    thumbnailPath: string
    videoUrl: string
    thumbnailUrl: string
  }>

  // Pipeline state
  currentStage?: string
  progress?: number
  settings?: Record<string, any>

  // Temporary files to clean up
  tempFiles: string[]
  filesToCleanup?: string[]

  // Error tracking
  error?: string

  // Custom data for stages to share state
  metadata?: Record<string, any>
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

  // Optional: retry configuration
  retryable?: boolean
  maxRetries?: number
  onError?(error: Error, context: PipelineContext): Promise<void>
}

export interface ProgressCallback {
  (jobId: string, status: string, progress: number, message: string): Promise<void> | void
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

export type TransitionType = 'cut' | 'flash' | 'zoom-in' | 'zoom-out'

export interface TransitionConfig {
  type: TransitionType
  duration?: number // in seconds
}

export interface CompilationConfig {
  transitions?: TransitionConfig[]
  defaultTransition?: TransitionType
  transitionDuration?: number
}

export interface PipelineConfig {
  maxRetries?: number
  retryDelay?: number
  cleanupOnFailure?: boolean
  progressCallback?: (jobId: string, status: string, progress: number, message: string) => Promise<void> | void
  compilation?: CompilationConfig
}

export class PipelineError extends Error {
  constructor(
    message: string,
    public stageName: string,
    public context?: PipelineContext,
    public cause?: Error
  ) {
    super(message)
    this.name = 'PipelineError'
  }
}
