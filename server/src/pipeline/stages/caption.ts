/**
 * Caption Pipeline Stage
 *
 * Orchestrates the complete captioning process:
 * 1. Transcribe audio using Whisper (local or API)
 * 2. Generate TikTok-style ASS subtitle file with word highlighting
 * 3. Burn captions into video using FFmpeg
 */

import {
  transcribeWithWhisperAPI,
  transcribeWithLocalWhisper,
  generateTikTokASS,
  burnCaptions,
  type TranscriptionResult,
  type TranscribeConfig,
} from '../../captions/transcribe'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export interface CaptionConfig {
  // Transcription settings
  transcription?: {
    method: 'api' | 'local'
    apiKey?: string // Required if method is 'api'
    model?: 'tiny' | 'base' | 'small' | 'medium' | 'large'
    language?: string
  }

  // ASS styling options
  styling?: {
    fontSize?: number
    fontName?: string
    primaryColor?: string
    highlightColor?: string
    outlineColor?: string
    position?: 'bottom' | 'center' | 'top'
  }

  // Output settings
  output?: {
    saveTranscription?: boolean // Save transcription JSON
    saveASS?: boolean // Save ASS file separately
    format?: 'srt' | 'ass'
  }
}

export interface CaptionResult {
  transcription: TranscriptionResult
  assPath: string
  outputVideoPath: string
  transcriptionPath?: string
}

export interface CaptionPipelineInput {
  videoPath: string
  outputDir: string
  config?: CaptionConfig
}

/**
 * Main caption pipeline stage
 *
 * @param input - Pipeline input with video path and output directory
 * @returns Result containing transcription, subtitle paths, and output video path
 *
 * @example
 * ```ts
 * const result = await captionStage({
 *   videoPath: '/path/to/video.mp4',
 *   outputDir: '/tmp/output',
 *   config: {
 *     transcription: {
 *       method: 'api',
 *       apiKey: process.env.OPENAI_API_KEY,
 *       model: 'base',
 *     },
 *     styling: {
 *       fontSize: 48,
 *       position: 'center',
 *     },
 *   },
 * })
 * ```
 */
export async function captionStage(
  input: CaptionPipelineInput
): Promise<CaptionResult> {
  const { videoPath, outputDir, config = {} } = input

  // Default configuration
  const transcriptionConfig = config.transcription || { method: 'local' as const }
  const stylingConfig = config.styling || {}
  const outputConfig = config.output || { format: 'ass' as const }

  // Step 1: Transcribe audio
  console.log('[Caption] Step 1/3: Transcribing audio...')
  const transcription = await transcribe(videoPath, transcriptionConfig)
  console.log(`[Caption] Transcribed ${transcription.segments.length} segments`)

  // Step 2: Generate ASS subtitle file
  console.log('[Caption] Step 2/3: Generating TikTok-style ASS subtitles...')
  const assContent = generateTikTokASS(transcription.segments, stylingConfig)
  const assPath = join(outputDir, 'captions.ass')
  await writeFile(assPath, assContent, 'utf-8')
  console.log(`[Caption] ASS file saved to: ${assPath}`)

  // Optional: Save transcription JSON
  let transcriptionPath: string | undefined
  if (outputConfig.saveTranscription) {
    transcriptionPath = join(outputDir, 'transcription.json')
    await writeFile(transcriptionPath, JSON.stringify(transcription, null, 2), 'utf-8')
    console.log(`[Caption] Transcription saved to: ${transcriptionPath}`)
  }

  // Step 3: Burn captions into video
  console.log('[Caption] Step 3/3: Burning captions into video...')
  const outputVideoPath = join(outputDir, 'captioned_video.mp4')
  await burnCaptions(videoPath, assPath, outputVideoPath, {
    format: outputConfig.format || 'ass',
  })
  console.log(`[Caption] Captioned video saved to: ${outputVideoPath}`)

  return {
    transcription,
    assPath,
    outputVideoPath,
    transcriptionPath,
  }
}

/**
 * Internal helper to transcribe based on configuration
 */
async function transcribe(
  videoPath: string,
  config: NonNullable<CaptionConfig['transcription']>
): Promise<TranscriptionResult> {
  const transcribeConfig: TranscribeConfig = {
    model: config.model || 'base',
    language: config.language,
    wordTimestamps: true,
  }

  if (config.method === 'api') {
    if (!config.apiKey) {
      throw new Error('API key is required when using Whisper API')
    }
    return await transcribeWithWhisperAPI(
      videoPath,
      config.apiKey,
      transcribeConfig
    )
  } else {
    return await transcribeWithLocalWhisper(videoPath, transcribeConfig)
  }
}

/**
 * Convenience function for API-based transcription
 */
export async function captionStageWithAPI(
  videoPath: string,
  outputDir: string,
  apiKey: string,
  options?: {
    model?: CaptionConfig['transcription']['model']
    language?: string
    styling?: CaptionConfig['styling']
  }
): Promise<CaptionResult> {
  return captionStage({
    videoPath,
    outputDir,
    config: {
      transcription: {
        method: 'api',
        apiKey,
        model: options?.model,
        language: options?.language,
      },
      styling: options?.styling,
      output: {
        saveTranscription: true,
        format: 'ass',
      },
    },
  })
}

/**
 * Convenience function for local Whisper transcription
 */
export async function captionStageWithLocal(
  videoPath: string,
  outputDir: string,
  options?: {
    model?: CaptionConfig['transcription']['model']
    language?: string
    styling?: CaptionConfig['styling']
  }
): Promise<CaptionResult> {
  return captionStage({
    videoPath,
    outputDir,
    config: {
      transcription: {
        method: 'local',
        model: options?.model,
        language: options?.language,
      },
      styling: options?.styling,
      output: {
        saveTranscription: true,
        format: 'ass',
      },
    },
  })
}
