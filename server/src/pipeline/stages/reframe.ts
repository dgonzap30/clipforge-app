/**
 * Reframe Pipeline Stage
 *
 * Wrapper around reframe.ts reframeVideo that converts extracted clips
 * to vertical format (9:16) using center crop for MVP.
 */

import { reframeVideo, createSplitScreen, type AspectRatio } from '../../extraction/reframe'
import type { PipelineContext, PipelineStage } from '../types'
import { readdir } from 'fs/promises'
import { join, extname, basename } from 'path'

/**
 * Determine if split-screen layout should be used for gaming content
 *
 * Checks:
 * 1. Explicit splitScreen setting in job settings
 * 2. Could be extended to auto-detect gaming content by checking VOD category
 * 3. Could check for dual video sources (facecam + gameplay)
 */
function shouldUseSplitScreen(context: PipelineContext): boolean {
  // Check explicit setting
  if (context.settings?.splitScreen === true) {
    return true
  }

  // For MVP, only use split-screen when explicitly enabled
  // Future enhancements could include:
  // - Auto-detection based on VOD category (gaming categories)
  // - Detection of dual video sources

  return false
}

/**
 * Reframe stage implementation
 *
 * Processes all clips in extractedClipsDir and reframes them to the target aspect ratio
 * using center crop (face tracking disabled for MVP).
 *
 * For gaming content with splitScreen enabled, uses split-screen layout
 * with facecam on top and gameplay on bottom.
 */
export const reframeStage: PipelineStage = {
  name: 'reframe',
  execute: async (context: PipelineContext): Promise<PipelineContext> => {
    const { extractedClipsDir, settings } = context

    if (!extractedClipsDir) {
      throw new Error('extractedClipsDir not found in context. Extract stage must run first.')
    }

    // Default to 9:16 for vertical video (TikTok/Shorts/Reels)
    const targetAspect: AspectRatio = settings?.targetAspect || '9:16'

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

    // Check if split-screen should be used
    const useSplitScreen = shouldUseSplitScreen(context)

    if (useSplitScreen) {
      console.log(`[Reframe] Split-screen mode enabled for gaming content (${targetAspect})`)
    } else {
      console.log(`[Reframe] Processing ${videoFiles.length} clips with center crop (${targetAspect})`)
    }

    // Process each clip
    const results = []
    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i]
      const inputPath = join(extractedClipsDir, file)
      const outputPath = join(reframedClipsDir, file)

      console.log(`[Reframe] ${i + 1}/${videoFiles.length}: ${basename(file)}`)

      try {
        if (useSplitScreen) {
          // Split-screen layout for gaming content
          // NOTE: This requires dual video sources (facecam + gameplay)
          // Check if we have metadata pointing to separate sources in context

          const facecamPath = context.metadata?.facecamPath
          const gameplayPath = context.metadata?.gameplayPath

          if (facecamPath && gameplayPath) {
            // We have dual sources - use split-screen layout
            console.log(`[Reframe] Creating split-screen layout with facecam and gameplay`)

            await createSplitScreen(gameplayPath, facecamPath, outputPath, {
              facecamRatio: 0.35,
              targetAspect,
            })

            results.push({
              file,
              outputPath,
              method: 'split_screen',
              keyframes: 0,
            })
          } else {
            // No dual sources available - fall back to standard reframe
            // This is expected for MVP since we don't have separate stream extraction yet
            console.log(`[Reframe] Split-screen enabled but dual sources not available, using standard reframe`)

            const result = await reframeVideo({
              inputPath,
              outputPath,
              targetAspect,
              faceTracking: false,
              smoothing: 0.7,
            })

            results.push({
              file,
              outputPath: result.outputPath,
              method: 'center_crop',
              keyframes: result.keyframes.length,
            })
          }
        } else {
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
        }

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
      reframedClips: results.map(r => ({
        path: r.outputPath,
        originalPath: join(extractedClipsDir, r.file),
        clipId: r.file.replace(/\.[^.]+$/, ''),
      })),
      currentStage: 'reframe',
      progress: 60, // Approximately 60% through the pipeline
    }
  },
}

/**
 * Export default for convenience
 */
export default reframeStage
