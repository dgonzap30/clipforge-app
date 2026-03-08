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
export interface ReframeStageConfig {
  onProgress?: (percent: number, message: string) => Promise<void> | void
}

/**
 * Reframe stage implementation wrapper
 */
export class ReframeStage implements PipelineStage {
  name = 'reframe'

  constructor(private config: ReframeStageConfig = {}) { }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { extractedClipsDir, settings, extractedClips } = context

    // Update progress reporter to use context if available
    const reporter = context.reportProgress
      ? (percent: number, message: string) => context.reportProgress!(percent, message)
      : (this.config.onProgress ? (percent: number, message: string) => this.config.onProgress!(percent, message) : undefined)

    if (!extractedClipsDir) {
      throw new Error('extractedClipsDir not found in context. Extract stage must run first.')
    }

    // Default to 9:16 for vertical video (TikTok/Shorts/Reels)
    const targetAspect: AspectRatio = settings?.targetAspect || '9:16'

    // Create output directory for reframed clips
    const reframedClipsDir = extractedClipsDir.replace('/extracted/', '/reframed/')
    const { mkdirSync } = await import('fs')
    mkdirSync(reframedClipsDir, { recursive: true })

    // Check if split-screen should be used
    const useSplitScreen = shouldUseSplitScreen(context)

    // Items to process
    let itemsToProcess: { path: string, startTime?: number, endTime?: number, clipId?: string }[] = []

    if (extractedClips && extractedClips.length > 0) {
      // Prefer using context data as it contains timestamps
      itemsToProcess = extractedClips.map(clip => ({
        path: clip.path,
        startTime: clip.startTime,
        endTime: clip.endTime,
        clipId: clip.clipId
      }))
    } else {
      // Fallback to directory listing (no timestamps available)
      const files = await readdir(extractedClipsDir)
      const videoFiles = files.filter((file) => {
        const ext = extname(file).toLowerCase()
        return ['.mp4', '.mov', '.avi', '.mkv'].includes(ext)
      })
      itemsToProcess = videoFiles.map(file => ({
        path: join(extractedClipsDir, file),
        clipId: file.replace(/\.[^.]+$/, '')
      }))
    }

    if (itemsToProcess.length === 0) {
      // Don't throw if no clips, just return context
      return { ...context, reframedClips: [], reframedClipsDir, currentStage: 'reframe', progress: 100 }
    }

    if (useSplitScreen) {
      console.log(`[Reframe] Split-screen mode enabled for gaming content (${targetAspect})`)
    } else {
      console.log(`[Reframe] Processing ${itemsToProcess.length} clips with smart reframing (${targetAspect})`)
    }

    // Process each clip
    const results = []
    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i]
      const inputPath = item.path
      const filename = basename(inputPath)
      const outputPath = join(reframedClipsDir, filename)

      const percent = Math.round((i / itemsToProcess.length) * 100)
      if (reporter) {
        await reporter(percent, `Reframing clip ${i + 1}/${itemsToProcess.length}: ${filename}`)
      }

      console.log(`[Reframe] ${i + 1}/${itemsToProcess.length}: ${filename}`)

      try {
        if (useSplitScreen) {
          // Split-screen layout for gaming content
          // Check if we have metadata pointing to separate sources in context
          const facecamPath = context.metadata?.facecamPath
          const gameplayPath = context.metadata?.gameplayPath

          if (facecamPath && gameplayPath) {
            // We have dual sources - use split-screen layout
            const startTime = item.startTime || 0
            const duration = (item.endTime && item.startTime) ? (item.endTime - item.startTime) : undefined

            console.log(`[Reframe] Creating split-screen layout (start: ${startTime}, dur: ${duration})`)

            await createSplitScreen(gameplayPath, facecamPath, outputPath, {
              facecamRatio: 0.35,
              targetAspect,
              startTime,
              duration
            })

            results.push({
              file: filename,
              outputPath,
              method: 'split_screen',
              keyframes: 0,
              clipId: item.clipId
            })
          } else {
            // No dual sources available - fall back to standard reframe
            console.log(`[Reframe] Split-screen enabled but dual sources not available, using standard reframe`)

            const result = await reframeVideo({
              inputPath,
              outputPath,
              targetAspect,
              faceTracking: true,
              smoothing: 0.7,
            })

            results.push({
              file: filename,
              outputPath: result.outputPath,
              method: result.method,
              keyframes: result.keyframes.length,
              clipId: item.clipId
            })
          }
        } else {
          // Use face tracking for smart reframing
          const result = await reframeVideo({
            inputPath,
            outputPath,
            targetAspect,
            faceTracking: true, // Enable MediaPipe face detection
            smoothing: 0.7,
          })

          results.push({
            file: filename,
            outputPath: result.outputPath,
            method: result.method,
            keyframes: result.keyframes.length,
            clipId: item.clipId
          })
        }

      } catch (error) {
        console.error(`[Reframe] Failed to process ${filename}:`, error)
        // Don't throw here, allow other clips to finish
      }
    }

    // Final progress update
    if (reporter) {
      await reporter(100, `Reframed ${results.length} clips`)
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
        clipId: r.clipId || r.file.replace(/\.[^.]+$/, ''),
      })),
      currentStage: 'reframe',
      progress: 100,
    }
  }
}

/**
 * Factory function for creating reframe stage
 */
export function createReframeStage(config?: ReframeStageConfig): PipelineStage {
  return new ReframeStage(config)
}

/**
 * Legacy export for backward compatibility until refactor is complete
 */
export const reframeStage = createReframeStage()
