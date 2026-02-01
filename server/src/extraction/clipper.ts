/**
 * Clip Extraction Module
 * 
 * Uses FFmpeg to extract clips from VODs.
 */

import { $ } from 'bun'
import { nanoid } from 'nanoid'
import { SignalMoment } from '../analysis/fusion'

export interface ClipConfig {
  inputPath: string
  outputDir: string
  moment: SignalMoment
  preRoll?: number
  postRoll?: number
  format?: 'mp4' | 'webm'
  quality?: 'high' | 'medium' | 'low'
}

export interface ExtractedClip {
  id: string
  path: string
  thumbnailPath: string
  startTime: number
  endTime: number
  duration: number
  moment: SignalMoment
}

// Quality presets
const QUALITY_PRESETS = {
  high: {
    crf: '18',
    preset: 'slow',
    audioBitrate: '192k',
  },
  medium: {
    crf: '23',
    preset: 'medium',
    audioBitrate: '128k',
  },
  low: {
    crf: '28',
    preset: 'fast',
    audioBitrate: '96k',
  },
}

/**
 * Extract a single clip from a VOD
 */
export async function extractClip(config: ClipConfig): Promise<ExtractedClip> {
  const {
    inputPath,
    outputDir,
    moment,
    preRoll = 5,
    postRoll = 8,
    format = 'mp4',
    quality = 'medium',
  } = config
  
  const startTime = Math.max(0, moment.timestamp - preRoll)
  const endTime = moment.timestamp + moment.duration - preRoll + postRoll
  const duration = endTime - startTime
  
  const clipId = nanoid()
  const outputPath = `${outputDir}/${clipId}.${format}`
  const thumbnailPath = `${outputDir}/${clipId}_thumb.jpg`
  
  const preset = QUALITY_PRESETS[quality]
  
  // Extract clip with FFmpeg
  await $`ffmpeg -ss ${startTime} -i ${inputPath} -t ${duration} \
    -c:v libx264 -crf ${preset.crf} -preset ${preset.preset} \
    -c:a aac -b:a ${preset.audioBitrate} \
    -movflags +faststart \
    -y ${outputPath}`
  
  // Generate thumbnail at the peak moment
  const thumbTime = preRoll // relative to clip start
  await $`ffmpeg -ss ${thumbTime} -i ${outputPath} \
    -vframes 1 -q:v 2 \
    -y ${thumbnailPath}`
  
  return {
    id: clipId,
    path: outputPath,
    thumbnailPath,
    startTime,
    endTime,
    duration,
    moment,
  }
}

/**
 * Extract multiple clips in batch
 */
export async function extractClipsBatch(
  inputPath: string,
  outputDir: string,
  moments: SignalMoment[],
  options: {
    maxConcurrent?: number
    quality?: 'high' | 'medium' | 'low'
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<ExtractedClip[]> {
  const { maxConcurrent = 2, quality = 'medium', onProgress } = options
  
  const results: ExtractedClip[] = []
  let completed = 0
  
  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < moments.length; i += maxConcurrent) {
    const batch = moments.slice(i, i + maxConcurrent)
    
    const batchResults = await Promise.all(
      batch.map(moment =>
        extractClip({
          inputPath,
          outputDir,
          moment,
          quality,
        })
      )
    )
    
    results.push(...batchResults)
    completed += batch.length
    
    if (onProgress) {
      onProgress(completed, moments.length)
    }
  }
  
  return results
}

/**
 * Concatenate multiple clips into one video
 */
export async function concatenateClips(
  clipPaths: string[],
  outputPath: string
): Promise<void> {
  // Create concat file
  const concatFile = `${outputPath}.txt`
  const concatContent = clipPaths.map(p => `file '${p}'`).join('\n')
  
  await Bun.write(concatFile, concatContent)
  
  // Concatenate
  await $`ffmpeg -f concat -safe 0 -i ${concatFile} \
    -c copy -y ${outputPath}`
  
  // Clean up
  await $`rm ${concatFile}`
}

/**
 * Get video duration using FFprobe
 */
export async function getVideoDuration(inputPath: string): Promise<number> {
  const result = await $`ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 ${inputPath}`.text()
  
  return parseFloat(result.trim())
}

/**
 * Get video resolution
 */
export async function getVideoResolution(inputPath: string): Promise<{
  width: number
  height: number
}> {
  const result = await $`ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=s=x:p=0 ${inputPath}`.text()
  
  const [width, height] = result.trim().split('x').map(Number)
  return { width, height }
}

/**
 * Check if FFmpeg is available
 */
export async function checkFFmpeg(): Promise<boolean> {
  try {
    await $`ffmpeg -version`.quiet()
    return true
  } catch {
    return false
  }
}
