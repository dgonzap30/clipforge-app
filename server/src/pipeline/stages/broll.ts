/**
 * B-roll Insertion Pipeline Stage
 *
 * Analyzes video transcripts using LLM to identify B-roll opportunities,
 * fetches stock footage from Pexels, and overlays it on the main video.
 */

import { $ } from 'bun'
import { join } from 'path'
import { readFile } from 'fs/promises'
import type { TranscriptionResult } from '../../captions/transcribe'
import { analyzeTranscriptForBRoll, type LLMConfig, type BRollSuggestion } from '../../lib/llm'
import { findBRollVideo, downloadPexelsVideo } from '../../lib/pexels'

export interface BRollConfig {
  enabled: boolean
  llm: LLMConfig
  pexelsApiKey: string
  maxBRolls?: number // Max number of B-roll inserts per video
  opacity?: number // Main video opacity during B-roll (0-1), default 0.4
  orientation?: 'landscape' | 'portrait' | 'square'
}

export interface BRollInsertionResult {
  outputPath: string
  insertions: Array<{
    timestamp: number
    duration: number
    searchQuery: string
    videoPath: string
  }>
}

export interface BRollStageInput {
  videoPath: string
  transcriptionPath: string
  outputDir: string
  config: BRollConfig
}

/**
 * B-roll insertion pipeline stage
 *
 * @param input - Pipeline input with video path, transcription, and config
 * @returns Result with output video path and insertion details
 */
export async function brollStage(
  input: BRollStageInput
): Promise<BRollInsertionResult> {
  const { videoPath, transcriptionPath, outputDir, config } = input

  if (!config.enabled) {
    console.log('[B-roll] B-roll insertion disabled, skipping stage')
    return {
      outputPath: videoPath,
      insertions: [],
    }
  }

  console.log('[B-roll] Starting B-roll insertion stage')

  // Step 1: Load transcription
  const transcription = await loadTranscription(transcriptionPath)
  console.log(`[B-roll] Loaded transcription with ${transcription.segments.length} segments`)

  // Step 2: Analyze transcript with LLM
  console.log('[B-roll] Analyzing transcript for B-roll opportunities...')
  const analysis = await analyzeTranscriptForBRoll(transcription, config.llm)
  console.log(`[B-roll] Found ${analysis.totalSuggestions} B-roll suggestions`)

  if (analysis.suggestions.length === 0) {
    console.log('[B-roll] No B-roll suggestions found, skipping insertion')
    return {
      outputPath: videoPath,
      insertions: [],
    }
  }

  // Limit number of B-rolls
  const maxBRolls = config.maxBRolls || 5
  const suggestions = analysis.suggestions.slice(0, maxBRolls)
  console.log(`[B-roll] Processing ${suggestions.length} B-roll insertions`)

  // Step 3: Download B-roll videos
  const brollVideos = await downloadBRollVideos(
    suggestions,
    config.pexelsApiKey,
    outputDir,
    config.orientation
  )

  if (brollVideos.length === 0) {
    console.log('[B-roll] No B-roll videos downloaded, skipping insertion')
    return {
      outputPath: videoPath,
      insertions: [],
    }
  }

  // Step 4: Insert B-rolls into video
  console.log('[B-roll] Inserting B-rolls into video...')
  const outputPath = join(outputDir, 'broll_video.mp4')
  await insertBRolls(videoPath, brollVideos, outputPath, config.opacity || 0.4)
  console.log(`[B-roll] B-roll video saved to: ${outputPath}`)

  return {
    outputPath,
    insertions: brollVideos,
  }
}

/**
 * Load transcription from JSON file
 */
async function loadTranscription(transcriptionPath: string): Promise<TranscriptionResult> {
  const content = await readFile(transcriptionPath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Download B-roll videos for each suggestion
 */
async function downloadBRollVideos(
  suggestions: BRollSuggestion[],
  pexelsApiKey: string,
  outputDir: string,
  orientation?: 'landscape' | 'portrait' | 'square'
): Promise<Array<{
  timestamp: number
  duration: number
  searchQuery: string
  videoPath: string
}>> {
  const results = []

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i]

    try {
      console.log(`[B-roll] Searching for: "${suggestion.searchQuery}"`)

      const brollVideo = await findBRollVideo(
        suggestion.searchQuery,
        pexelsApiKey,
        {
          orientation,
          minDuration: suggestion.duration,
        }
      )

      if (!brollVideo) {
        console.warn(`[B-roll] No video found for: "${suggestion.searchQuery}"`)
        continue
      }

      // Download video
      const videoPath = join(outputDir, `broll_${i}.mp4`)
      console.log(`[B-roll] Downloading: ${brollVideo.downloadUrl}`)
      await downloadPexelsVideo(brollVideo.downloadUrl, videoPath)

      results.push({
        timestamp: suggestion.timestamp,
        duration: suggestion.duration,
        searchQuery: suggestion.searchQuery,
        videoPath,
      })

      console.log(`[B-roll] Downloaded B-roll ${i + 1}/${suggestions.length}`)
    } catch (err) {
      console.error(`[B-roll] Failed to download B-roll for "${suggestion.searchQuery}":`, err)
    }
  }

  return results
}

/**
 * Insert B-rolls into main video using FFmpeg overlay filter
 */
async function insertBRolls(
  mainVideoPath: string,
  brolls: Array<{
    timestamp: number
    duration: number
    videoPath: string
  }>,
  outputPath: string,
  mainOpacity: number
): Promise<void> {
  // Build complex FFmpeg filter for B-roll overlays
  // Strategy: Use overlay filter with enable expression to show B-roll at specific times

  // Get main video dimensions
  const dimsResult = await $`ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=s=x:p=0 ${mainVideoPath}`.text()

  const [width, height] = dimsResult.trim().split('x').map(Number)

  // Build filter graph
  let filterComplex = ''
  let inputs = ['-i', mainVideoPath]

  // Add B-roll inputs
  for (let i = 0; i < brolls.length; i++) {
    inputs.push('-i', brolls[i].videoPath)
  }

  // Create base layer (main video)
  filterComplex += `[0:v]format=yuva420p,colorchannelmixer=aa=${mainOpacity}[base];`

  // Process each B-roll
  for (let i = 0; i < brolls.length; i++) {
    const broll = brolls[i]
    const inputIdx = i + 1
    const endTime = broll.timestamp + broll.duration

    // Scale B-roll to match main video size and trim to duration
    filterComplex += `[${inputIdx}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,`
    filterComplex += `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,`
    filterComplex += `trim=duration=${broll.duration},setpts=PTS-STARTPTS[broll${i}];`

    // Overlay B-roll on base layer
    const prevLayer = i === 0 ? 'base' : `tmp${i - 1}`
    const currentLayer = i === brolls.length - 1 ? 'out' : `tmp${i}`

    filterComplex += `[${prevLayer}][broll${i}]overlay=`
    filterComplex += `enable='between(t,${broll.timestamp},${endTime})'`
    filterComplex += `[${currentLayer}];`
  }

  // Remove trailing semicolon
  filterComplex = filterComplex.slice(0, -1)

  // Execute FFmpeg command
  const args = [
    'ffmpeg',
    ...inputs,
    '-filter_complex',
    filterComplex,
    '-map',
    '[out]',
    '-map',
    '0:a?', // Copy audio from main video
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'medium',
    '-c:a',
    'copy',
    '-y',
    outputPath,
  ]

  await $`${args}`
}
