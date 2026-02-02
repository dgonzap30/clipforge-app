/**
 * Analyze Stage
 *
 * Analyzes VOD audio and fuses signals to find clip moments
 */

import { PipelineContext, PipelineStage } from '../types'
import { extractAudio, getAudioLevels, analyzeAudioLevels } from '../../analysis/audio'
import { fuseSignals } from '../../analysis/fusion'
import path from 'path'

export const analyzeStage: PipelineStage = {
  name: 'analyze',
  retryable: true,
  maxRetries: 2,

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    if (!ctx.vodPath) {
      throw new Error('VOD path not found in context')
    }

    console.log(`[analyze] Starting audio analysis for ${ctx.vodPath}`)

    // Extract audio
    const audioPath = path.join(ctx.tempDir, `${ctx.vodId}_audio.wav`)
    await extractAudio(ctx.vodPath, audioPath)
    ctx.audioPath = audioPath
    ctx.filesToCleanup.push(audioPath)
    ctx.progress = 20

    console.log(`[analyze] Audio extracted to ${audioPath}`)

    // Get audio levels
    const audioLevels = await getAudioLevels(audioPath, {
      windowSize: 0.5,
      peakThreshold: 0.7,
      silenceThreshold: 0.1,
      minGap: 3,
    })
    ctx.progress = 30

    console.log(`[analyze] Analyzed ${audioLevels.length} audio samples`)

    // Analyze audio to find moments
    const audioMoments = analyzeAudioLevels(audioLevels, {
      windowSize: 0.5,
      peakThreshold: 0.7,
      silenceThreshold: 0.1,
      minGap: 3,
    })
    ctx.progress = 35

    console.log(`[analyze] Found ${audioMoments.length} audio moments`)

    // For now, no chat analysis (would require Twitch chat logs)
    const chatMoments: any[] = []

    // Fuse signals with weights: chat=0, audio=0.8, clips=0.2
    const fusedMoments = fuseSignals(chatMoments, audioMoments, [], {
      weights: {
        chat: 0,
        audio: 0.8,
        clips: 0.2,
      },
      minScore: ctx.settings.sensitivity === 'high' ? 20 : ctx.settings.sensitivity === 'low' ? 50 : 30,
      minDuration: ctx.settings.minDuration,
      maxDuration: ctx.settings.maxDuration,
    })

    console.log(`[analyze] Fused signals into ${fusedMoments.length} clip moments`)

    ctx.analysisResults = {
      audioMoments,
      chatMoments,
      fusedMoments,
      clipsFound: fusedMoments.length,
    }
    ctx.progress = 40

    if (fusedMoments.length === 0) {
      console.warn('[analyze] No clip moments found in VOD')
    }

    return ctx
  },
}
