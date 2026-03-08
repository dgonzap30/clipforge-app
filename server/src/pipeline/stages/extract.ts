/**
 * Extract Stage
 *
 * Wraps clipper.ts extractClipsBatch to extract clips from VOD
 * and creates clip records in Supabase database.
 */

import { PipelineContext, PipelineStage } from '../types'
import { extractClipsBatch, ExtractedClip } from '../../extraction/clipper'
import { supabase } from '../../lib/supabase'

export interface ExtractStageConfig {
  maxConcurrent?: number
  quality?: 'high' | 'medium' | 'low'
  preRoll?: number
  postRoll?: number
  onProgress?: (percent: number, message: string) => void
}

/**
 * Extract Stage Implementation
 */
export class ExtractStage implements PipelineStage {
  name = 'extract'

  constructor(private config: ExtractStageConfig = {}) { }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { jobId, userId, vodId, outputDir, moments } = context
    const vodPath = context.downloadedVideoPath || context.vodPath

    // Update progress reporter to use context if available
    const reporter = context.reportProgress
      ? (percent: number, message: string) => context.reportProgress!(percent, message)
      : (this.config.onProgress ? (percent: number, message: string) => this.config.onProgress!(percent, message) : undefined)

    // Validate required context
    if (!vodPath) {
      throw new Error('Extract stage requires vodPath or downloadedVideoPath in context')
    }

    if (!moments || moments.length === 0) {
      throw new Error('Extract stage requires moments array in context')
    }

    if (!outputDir) {
      throw new Error('Extract stage requires outputDir in context')
    }

    if (!jobId) {
      throw new Error('Extract stage requires jobId in context')
    }

    if (!userId) {
      throw new Error('Extract stage requires userId in context')
    }

    if (!vodId) {
      throw new Error('Extract stage requires vodId in context')
    }

    // Extract clips using clipper.ts
    const extractedClips = await extractClipsBatch(
      vodPath!,
      outputDir!,
      moments,
      {
        maxConcurrent: this.config.maxConcurrent || 2,
        quality: this.config.quality || 'medium',
        onProgress: reporter
          ? (completed: number, total: number) => {
            const percent = Math.round((completed / total) * 100)
            reporter(percent, `Extracted ${completed}/${total} clips`)
          }
          : undefined,
      }
    )

    // Create clip records in Supabase database
    await this.createClipRecords(
      extractedClips,
      jobId,
      userId,
      vodId,
      context
    )

    // Return updated context with extracted clips
    return {
      ...context,
      extractedClips: extractedClips.map((clip, idx) => ({
        ...clip,
        clipId: clip.id || `clip-${idx}`,
      })),
      extractedClipsDir: outputDir!,
    }
  }

  /**
   * Create clip records in Supabase database
   */
  private async createClipRecords(
    extractedClips: ExtractedClip[],
    jobId: string,
    userId: string,
    vodId: string,
    _context: PipelineContext
  ): Promise<any[]> {

    const clipRecords = extractedClips.map((clip) => ({
      id: clip.id,
      job_id: jobId,
      user_id: userId,
      vod_id: vodId,
      title: clip.moment.suggestedTitle || 'Untitled Clip',
      start_time: clip.startTime,
      end_time: clip.endTime,
      status: 'processing',
      hyde_score: clip.moment.score,
      signals: {
        chat: clip.moment.signals.chat,
        audio: clip.moment.signals.audio,
        clips: clip.moment.signals.clips,
      },
      // File paths (will be updated in upload stage with final URLs)
      video_path: clip.path,
      thumbnail_path: clip.thumbnailPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Insert clips into database
    const { data, error } = await supabase.from('clips').insert(clipRecords)

    if (error) {
      throw new Error(`Failed to create clip records in database: ${error}`)
    }

    return data || clipRecords
  }
}

/**
 * Factory function to create extract stage
 */
export function createExtractStage(config?: ExtractStageConfig): PipelineStage {
  return new ExtractStage(config)
}
