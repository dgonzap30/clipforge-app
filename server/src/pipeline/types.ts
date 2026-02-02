/**
 * Pipeline Types
 *
 * Defines the structure for the VOD processing pipeline stages.
 */

import { SignalMoment } from '../analysis/fusion'
import { ExtractedClip } from '../extraction/clipper'

export interface PipelineContext {
  jobId: string
  userId: string
  vodId: string
  vodUrl: string
  vodPath?: string
  outputDir: string
  moments?: SignalMoment[]
  extractedClips?: ExtractedClip[]
  metadata?: {
    title: string
    duration: number
    channel: string
    [key: string]: any
  }
}

export interface PipelineStage {
  name: string
  execute(context: PipelineContext): Promise<PipelineContext>
}

export interface StageProgress {
  stage: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number // 0-100
  message?: string
  error?: string
}
