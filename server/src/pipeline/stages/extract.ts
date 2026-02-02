/**
 * Extract Stage
 *
 * Wraps clipper.ts extractClipsBatch to extract clips from VOD
 * and creates clip records in Supabase database.
 */

import { PipelineContext, PipelineStage } from '../types'
import { extractClipsBatch, ExtractedClip } from '../../extraction/clipper'
import { nanoid } from 'nanoid'

// TODO: Import from server/src/lib/supabase.ts when it exists
// For now, we'll define a minimal interface
interface SupabaseClient {
  from(table: string): {
    insert(data: any): Promise<{ data: any; error: any }>
    update(data: any): Promise<{ data: any; error: any }>
  }
}

// Placeholder for Supabase client - will be replaced with actual import
let supabase: SupabaseClient | null = null

export function initializeSupabaseClient(client: SupabaseClient) {
  supabase = client
}

export interface ExtractStageConfig {
  maxConcurrent?: number
  quality?: 'high' | 'medium' | 'low'
  preRoll?: number
  postRoll?: number
  onProgress?: (completed: number, total: number) => void
}

/**
 * Extract Stage Implementation
 */
export class ExtractStage implements PipelineStage {
  name = 'extract'

  constructor(private config: ExtractStageConfig = {}) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { jobId, userId, vodId, vodPath, outputDir, moments } = context

    // Validate required context
    if (!vodPath) {
      throw new Error('Extract stage requires vodPath in context')
    }

    if (!moments || moments.length === 0) {
      throw new Error('Extract stage requires moments array in context')
    }

    if (!outputDir) {
      throw new Error('Extract stage requires outputDir in context')
    }

    // Extract clips using clipper.ts
    const extractedClips = await extractClipsBatch(
      vodPath,
      outputDir,
      moments,
      {
        maxConcurrent: this.config.maxConcurrent || 2,
        quality: this.config.quality || 'medium',
        onProgress: this.config.onProgress,
      }
    )

    // Create clip records in Supabase database
    const clipRecords = await this.createClipRecords(
      extractedClips,
      jobId,
      userId,
      vodId,
      context
    )

    // Return updated context with extracted clips
    return {
      ...context,
      extractedClips,
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
    context: PipelineContext
  ): Promise<any[]> {
    // If Supabase client is not initialized, skip database insertion
    // This allows the stage to work in isolation for testing
    if (!supabase) {
      console.warn('Supabase client not initialized, skipping clip record creation')
      return []
    }

    const clipRecords = extractedClips.map((clip) => ({
      id: clip.id,
      job_id: jobId,
      user_id: userId,
      vod_id: vodId,
      title: clip.moment.suggestedTitle || 'Untitled Clip',
      start_time: clip.startTime,
      end_time: clip.endTime,
      duration: clip.duration,
      status: 'processing',
      hyde_score: clip.moment.score,
      confidence: clip.moment.confidence,
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
