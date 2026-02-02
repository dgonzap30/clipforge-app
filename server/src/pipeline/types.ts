/**
 * Pipeline Type Definitions
 *
 * Defines the structure for the ClipForge processing pipeline.
 */

import { SignalMoment } from '../analysis/fusion'
import { ExtractedClip } from '../extraction/clipper'

export interface PipelineContext {
  // Job info
  jobId: string
  userId: string

  // Input
  vodId: string
  vodUrl: string
  vodTitle: string

  // Processing settings
  settings: {
    clipCount?: number
    minDuration?: number
    maxDuration?: number
    targetAspect?: '9:16' | '1:1' | '16:9' | '4:5'
    quality?: 'high' | 'medium' | 'low'
    includeCaptions?: boolean
    faceTracking?: boolean
  }

  // Intermediate outputs (populated by stages)
  downloadedPath?: string
  audioPath?: string
  moments?: SignalMoment[]
  extractedClips?: ExtractedClip[]
  reframedClips?: Array<{
    clipId: string
    path: string
  }>
  captionedClips?: Array<{
    clipId: string
    path: string
    captionsPath?: string
  }>
  uploadedClips?: Array<{
    clipId: string
    videoPath: string
    thumbnailPath: string
    videoUrl: string
    thumbnailUrl: string
  }>

  // Temp directory for processing
  tempDir: string

  // Progress tracking
  currentStage?: string
  progress?: number
  error?: string
}

export interface PipelineStage {
  name: string
  execute: (context: PipelineContext) => Promise<PipelineContext>
  cleanup?: (context: PipelineContext) => Promise<void>
}

export interface PipelineResult {
  success: boolean
  jobId: string
  clipIds?: string[]
  error?: string
}

export interface StageProgress {
  stage: string
  progress: number
  message?: string
}
