/**
 * Pipeline Types
 *
 * Defines the structure for the video processing pipeline stages.
 */

export interface PipelineContext {
  // Job metadata
  jobId: string
  userId: string
  vodId: string

  // File paths - updated as pipeline progresses
  downloadedVideoPath?: string
  analyzedDataPath?: string
  extractedClipsDir?: string
  reframedClipsDir?: string
  captionedClipsDir?: string
  uploadedClipIds?: string[]

  // Processing state
  currentStage: string
  progress: number // 0-100
  error?: string

  // Configuration
  settings: {
    targetAspect?: '9:16' | '1:1' | '16:9' | '4:5'
    enableCaptions?: boolean
    minClipDuration?: number
    maxClipDuration?: number
  }
}

export interface PipelineStage {
  name: string
  execute: (context: PipelineContext) => Promise<PipelineContext>
}
