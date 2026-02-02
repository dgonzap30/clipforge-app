/**
 * Extract Stage
 *
 * Extracts clips from VOD based on analysis results
 */

import { PipelineContext, PipelineStage } from '../types'
import { extractClipsBatch } from '../../extraction/clipper'

export const extractStage: PipelineStage = {
  name: 'extract',
  retryable: true,
  maxRetries: 2,

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.vodPath) {
      throw new Error('VOD path not found in context')
    }

    if (!ctx.analysisResults?.fusedMoments) {
      throw new Error('No analysis results found in context')
    }

    const { fusedMoments } = ctx.analysisResults

    if (fusedMoments.length === 0) {
      console.log('[extract] No moments to extract, skipping extraction')
      ctx.clipPaths = []
      ctx.progress = 55
      return ctx
    }

    console.log(`[extract] Extracting ${fusedMoments.length} clips from VOD`)

    // Extract clips in batch
    const extractedClips = await extractClipsBatch(
      ctx.vodPath,
      ctx.outputDir,
      fusedMoments,
      {
        maxConcurrent: 2,
        quality: 'medium',
        onProgress: (completed, total) => {
          // Scale extraction to 40-55% of total progress
          ctx.progress = 40 + Math.floor((completed / total) * 15)
          console.log(`[extract] Progress: ${completed}/${total} clips extracted`)
        },
      }
    )

    console.log(`[extract] Extracted ${extractedClips.length} clips`)

    // Store clip paths for next stage
    ctx.clipPaths = extractedClips.map(clip => clip.path)

    // Track thumbnails for cleanup
    extractedClips.forEach(clip => {
      ctx.filesToCleanup.push(clip.path)
      ctx.filesToCleanup.push(clip.thumbnailPath)
    })

    ctx.progress = 55

    return ctx
  },
}
