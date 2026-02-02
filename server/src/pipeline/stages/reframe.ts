/**
 * Reframe Pipeline Stage
 *
 * Wrapper around reframe.ts reframeVideo that converts extracted clips
 * to vertical format (9:16) using center crop for MVP.
 */

import { reframeVideo, type AspectRatio } from '../../extraction/reframe'
import type { PipelineContext, PipelineStage } from '../types'
import { readdir } from 'fs/promises'
import { join, extname, basename } from 'path'

/**
 * Reframe stage implementation
 *
 * Processes all clips in extractedClipsDir and reframes them to the target aspect ratio
 * using center crop (face tracking disabled for MVP).
 */
export const reframeStage: PipelineStage = {
  name: 'reframe',
  execute: async (context: PipelineContext): Promise<PipelineContext> => {
    const { extractedClipsDir, settings } = context

    if (!extractedClipsDir) {
      throw new Error('extractedClipsDir not found in context. Extract stage must run first.')
    }

    // Default to 9:16 for vertical video (TikTok/Shorts/Reels)
    const targetAspect: AspectRatio = settings.targetAspect || '9:16'

    // Create output directory for reframed clips
    const reframedClipsDir = extractedClipsDir.replace('/extracted/', '/reframed/')
    const { mkdirSync } = await import('fs')
    mkdirSync(reframedClipsDir, { recursive: true })

    // Get all video files from extracted clips directory
    const files = await readdir(extractedClipsDir)
    const videoFiles = files.filter((file) => {
      const ext = extname(file).toLowerCase()
      return ['.mp4', '.mov', '.avi', '.mkv'].includes(ext)
    })

    if (videoFiles.length === 0) {
      throw new Error(`No video files found in ${extractedClipsDir}`)
    }

    console.log(`[Reframe] Processing ${videoFiles.length} clips with center crop (${targetAspect})`)

    // Process each clip
    const results = []
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i]
      const inputPath = join(extractedClipsDir, file)
      const outputPath = join(reframedClipsDir, file)

      console.log(`[Reframe] ${i + 1}/${videoFiles.length}: ${basename(file)}`)

      try {
        // Use center crop for MVP (faceTracking disabled)
        const result = await reframeVideo({
          inputPath,
          outputPath,
          targetAspect,
          faceTracking: false, // MVP: disabled for simplicity and performance
          smoothing: 0.7,
        })

        results.push({
          file,
          outputPath: result.outputPath,
          method: result.method,
          keyframes: result.keyframes.length,
        })

        // Update progress
        const progress = Math.round(((i + 1) / videoFiles.length) * 100)
        console.log(`[Reframe] Progress: ${progress}%`)
      } catch (error) {
        console.error(`[Reframe] Failed to process ${file}:`, error)
        throw new Error(`Failed to reframe ${file}: ${error}`)
      }
    }

    console.log(`[Reframe] Completed ${results.length} clips`)
    console.log(
      `[Reframe] Methods used: ${results.map((r) => `${r.file}: ${r.method}`).join(', ')}`
    )

    return {
      ...context,
      reframedClipsDir,
      currentStage: 'reframe',
      progress: 60, // Approximately 60% through the pipeline
    }
  },
}

/**
 * Export default for convenience
 */
export default reframeStage
