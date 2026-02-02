/**
 * Caption Stage
 *
 * Generates and burns captions into clips using Whisper
 */

import { PipelineContext, PipelineStage } from '../types'
import { transcribeWithWhisperAPI, generateTikTokASS, burnCaptions } from '../../captions/transcribe'
import { env } from '../../lib/env'
import path from 'path'

export const captionStage: PipelineStage = {
  name: 'caption',
  retryable: true,
  maxRetries: 2,

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    // Skip if auto captions disabled
    if (!ctx.settings.autoCaptions) {
      console.log('[caption] Auto captions disabled, skipping')
      ctx.captionedPaths = ctx.reframedPaths || []
      ctx.progress = 85
      return ctx
    }

    if (!ctx.reframedPaths || ctx.reframedPaths.length === 0) {
      console.log('[caption] No clips to caption, skipping')
      ctx.captionedPaths = []
      ctx.progress = 85
      return ctx
    }

    if (!env.OPENAI_API_KEY) {
      console.warn('[caption] OpenAI API key not configured, skipping captions')
      ctx.captionedPaths = ctx.reframedPaths
      ctx.progress = 85
      return ctx
    }

    console.log(`[caption] Adding captions to ${ctx.reframedPaths.length} clips`)

    const captionedPaths: string[] = []
    const total = ctx.reframedPaths.length

    for (let i = 0; i < ctx.reframedPaths.length; i++) {
      const clipPath = ctx.reframedPaths[i]
      const clipName = path.basename(clipPath, path.extname(clipPath))
      const assPath = path.join(ctx.tempDir, `${clipName}.ass`)
      const captionedPath = path.join(ctx.outputDir, `${clipName}_captioned.mp4`)

      console.log(`[caption] Transcribing clip ${i + 1}/${total}: ${clipPath}`)

      try {
        // Transcribe with Whisper
        const transcription = await transcribeWithWhisperAPI(
          clipPath,
          env.OPENAI_API_KEY,
          {
            model: 'base',
            wordTimestamps: true,
          }
        )

        // Generate TikTok-style ASS captions
        const assContent = generateTikTokASS(transcription.segments, {
          fontSize: 48,
          fontName: 'Arial Black',
          position: 'center',
        })

        // Write ASS file
        await Bun.write(assPath, assContent)
        ctx.filesToCleanup.push(assPath)

        // Burn captions into video
        await burnCaptions(clipPath, assPath, captionedPath, { format: 'ass' })

        captionedPaths.push(captionedPath)
        ctx.filesToCleanup.push(captionedPath)

        console.log(`[caption] Captioned clip ${i + 1}/${total}`)
      } catch (error) {
        console.error(`[caption] Failed to caption clip ${clipPath}:`, error)
        // Fall back to uncaptioned clip
        captionedPaths.push(clipPath)
      }

      // Scale captioning to 70-85% of total progress
      ctx.progress = 70 + Math.floor(((i + 1) / total) * 15)
    }

    console.log(`[caption] Captioned ${captionedPaths.length} clips`)

    ctx.captionedPaths = captionedPaths
    ctx.progress = 85

    return ctx
  },
}
