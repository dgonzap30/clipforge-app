/**
 * Pipeline Types Module
 *
 * Defines the core interfaces for the video processing pipeline.
 * The pipeline orchestrates multiple stages of processing from VOD download
 * through analysis, extraction, reframing, captioning, and final upload.
 */

import { SignalMoment } from '../analysis/fusion'
import { ExtractedClip } from '../extraction/clipper'
import { AudioMoment } from '../analysis/audio'
import { ChatMoment } from '../analysis/chat'

/**
 * Context passed through all pipeline stages
 * Contains job metadata, file paths, and accumulated results from each stage
 */
export interface PipelineContext {
  // Job identification
  jobId: string
  userId: string
  vodId: string
  vodUrl: string

  // Job metadata
  vodMetadata: {
    title: string
    channelLogin: string
    duration: number // seconds
    createdAt: string
  }

  // Processing settings from job configuration
  settings: {
    minDuration: number
    maxDuration: number
    sensitivity: 'low' | 'medium' | 'high'
    chatAnalysis: boolean
    audioPeaks: boolean
    faceReactions: boolean
    autoCaptions: boolean
    outputFormat: 'vertical' | 'square' | 'horizontal'
  }

  // File paths for intermediate artifacts
  paths: {
    workDir: string // temporary working directory for this job
    vodFile?: string // downloaded VOD file
    audioFile?: string // extracted audio
    clipsDir?: string // directory for extracted clips
    outputDir?: string // final processed clips
  }

  // Results accumulated from each stage
  results: {
    // Download stage
    downloadedAt?: string
    vodDuration?: number

    // Analysis stage
    audioMoments?: AudioMoment[]
    chatMoments?: ChatMoment[]
    fusedMoments?: SignalMoment[]

    // Extraction stage
    extractedClips?: ExtractedClip[]

    // Reframe stage
    reframedClipPaths?: Map<string, string> // clipId -> reframed file path

    // Caption stage
    captionedClipPaths?: Map<string, string> // clipId -> captioned file path

    // Upload stage
    uploadedClips?: Array<{
      clipId: string
      videoPath: string // Supabase storage path
      thumbnailPath: string // Supabase storage path
      signedUrl?: string
    }>
  }

  // Progress tracking
  progress: {
    currentStage: string
    stageProgress: number // 0-100 for current stage
    overallProgress: number // 0-100 for entire pipeline
    message: string
  }

  // Error handling
  errors: Array<{
    stage: string
    error: Error
    timestamp: string
    fatal: boolean
  }>

  // Timestamps
  startedAt: string
  updatedAt: string
  completedAt?: string
}

/**
 * Result type for pipeline stage execution
 */
export interface PipelineStageResult {
  success: boolean
  context: PipelineContext
  error?: Error
  skipReason?: string // If stage was skipped (e.g., chat analysis disabled)
}

/**
 * Base interface for pipeline stages
 * Each stage receives context, performs its work, and returns updated context
 */
export interface PipelineStage {
  /**
   * Stage name for logging and progress tracking
   */
  name: string

  /**
   * Human-readable description of what this stage does
   */
  description: string

  /**
   * Execute the stage
   * @param context - Current pipeline context
   * @returns Updated context with results from this stage
   */
  execute(context: PipelineContext): Promise<PipelineStageResult>

  /**
   * Optional validation before executing stage
   * Can check if prerequisites are met, files exist, etc.
   * @param context - Current pipeline context
   * @returns true if stage can proceed, false to skip
   */
  canExecute?(context: PipelineContext): Promise<boolean>

  /**
   * Optional cleanup on stage failure
   * Remove temporary files, release resources, etc.
   * @param context - Pipeline context at time of failure
   */
  cleanup?(context: PipelineContext): Promise<void>

  /**
   * Optional retry configuration
   */
  retryConfig?: {
    maxRetries: number
    retryDelayMs: number
    retryableErrors?: string[] // Error messages that should trigger retry
  }
}

/**
 * Progress callback for reporting stage progress
 */
export type ProgressCallback = (context: PipelineContext) => Promise<void>

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  // Stages to execute in order
  stages: PipelineStage[]

  // Progress reporting callback
  onProgress?: ProgressCallback

  // Global error handling
  onError?: (context: PipelineContext, error: Error) => Promise<void>

  // Cleanup configuration
  cleanupOnSuccess?: boolean // Remove temp files after successful completion
  cleanupOnFailure?: boolean // Remove temp files after failure
}

/**
 * Helper type for creating stage-specific context updates
 */
export type ContextUpdate = Partial<Pick<PipelineContext, 'paths' | 'results' | 'progress' | 'errors'>>

/**
 * Stage execution status
 */
export enum StageStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Stage execution record for tracking
 */
export interface StageExecution {
  stageName: string
  status: StageStatus
  startedAt?: string
  completedAt?: string
  duration?: number // milliseconds
  error?: Error
  retryCount: number
}
