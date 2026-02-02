/**
 * Reframe Stage
 *
 * Converts clips to target aspect ratio (vertical for TikTok/Reels)
 */

import { PipelineContext, PipelineStage } from '../types'
import { reframeVideo, type AspectRatio } from '../../extraction/reframe'
import path from 'path'

const OUTPUT_FORMAT_TO_ASPECT: Record<string, AspectRatio> = {
  'vertical': '9:16',
  'square': '1:1',
  'horizontal': '16:9',
}

export const reframeStage: PipelineStage = {
  name: 'reframe',
  retryable: true,
  maxRetries: 2,

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.clipPaths || ctx.clipPaths.length === 0) {
      console.log('[reframe] No clips to reframe, skipping')
      ctx.reframedPaths = []
      ctx.progress = 70
      return ctx
    }

    const targetAspect = OUTPUT_FORMAT_TO_ASPECT[ctx.settings.outputFormat] || '9:16'

    console.log(`[reframe] Reframing ${ctx.clipPaths.length} clips to ${targetAspect}`)

    const reframedPaths: string[] = []
    const total = ctx.clipPaths.length

    for (let i = 0; i < ctx.clipPaths.length; i++) {
      const clipPath = ctx.clipPaths[i]
      const clipName = path.basename(clipPath, path.extname(clipPath))
      const reframedPath = path.join(ctx.outputDir, `${clipName}_reframed.mp4`)

      console.log(`[reframe] Reframing clip ${i + 1}/${total}: ${clipPath}`)

      // Use center crop for MVP (face tracking can be added later)
      const result = await reframeVideo({
        inputPath: clipPath,
        outputPath: reframedPath,
        targetAspect,
        faceTracking: false, // MVP: center crop only
        smoothing: 0.7,
      })

      reframedPaths.push(result.outputPath)
      ctx.filesToCleanup.push(result.outputPath)

      // Scale reframing to 55-70% of total progress
      ctx.progress = 55 + Math.floor(((i + 1) / total) * 15)
    }

    console.log(`[reframe] Reframed ${reframedPaths.length} clips`)

    ctx.reframedPaths = reframedPaths
    ctx.progress = 70

    return ctx
  },
}
