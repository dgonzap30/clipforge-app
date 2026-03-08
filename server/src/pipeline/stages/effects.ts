/**
 * Effects Pipeline Stage
 *
 * Applies visual effects to clips:
 * - Auto-zoom on audio peaks (face-aware if tracking enabled)
 * - Configurable zoom intensity
 * - Transition effects for multi-clip compilations
 */

import type { PipelineContext, PipelineStage, TransitionType } from '../types'
import { SignalMoment } from '../../analysis/fusion'
import type { CropKeyframe } from '../../extraction/reframe'
import { concatenateClipsWithTransitions, TransitionOptions } from '../../extraction/clipper'
import { $ } from 'bun'
import { join, basename } from 'path'
import { existsSync } from 'fs'

export interface ZoomKeyframe {
  time: number // seconds
  zoom: number // zoom factor (1.0 = no zoom, 1.3 = 30% zoomed)
  x?: number // optional pan x offset (for face tracking)
  y?: number // optional pan y offset (for face tracking)
}

export interface EffectsConfig {
  autoZoom?: boolean
  zoomIntensity?: 'subtle' | 'medium' | 'strong'
  zoomDuration?: number // seconds for zoom transition
  zoomHoldDuration?: number // seconds to hold zoom at peak
}

export interface EffectsStageConfig {
  defaultTransition?: TransitionType
  transitionDuration?: number
  transitions?: TransitionOptions[]
  outputFileName?: string
}

const ZOOM_INTENSITY_MAP = {
  'subtle': 1.2,
  'medium': 1.3,
  'strong': 1.5,
}

const DEFAULT_ZOOM_DURATION = 0.5
const DEFAULT_ZOOM_HOLD = 1.0

/**
 * Effects Stage Implementation
 * Supports both auto-zoom effects and multi-clip transitions
 */
export class EffectsStage implements PipelineStage {
  name = 'effects'

  constructor(private config: EffectsStageConfig = {}) { }

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { outputDir, captionedClips, reframedClips } = context

    // Validate required context
    if (!outputDir) {
      throw new Error('Effects stage requires outputDir in context')
    }

    // Determine which clips to use (captioned if available, otherwise reframed)
    const clipsToCompile = captionedClips || reframedClips

    if (!clipsToCompile || clipsToCompile.length === 0) {
      throw new Error('Effects stage requires captionedClips or reframedClips in context')
    }

    // If only one clip, skip compilation
    if (clipsToCompile.length === 1) {
      return {
        ...context,
        compiledClipPath: clipsToCompile[0].path,
      }
    }

    // Validate all clip paths exist
    const clipPaths = clipsToCompile.map(c => c.path)
    for (const path of clipPaths) {
      if (!existsSync(path)) {
        throw new Error(`Clip file not found: ${path}`)
      }
    }

    // Generate output path
    const outputFileName = this.config.outputFileName || `compilation-${Date.now()}.mp4`
    const outputPath = `${outputDir}/${outputFileName}`

    // Get transition configuration
    const defaultTransition = this.config.defaultTransition || 'cut'
    const transitionDuration = this.config.transitionDuration || 0.3

    // Build transitions array
    let transitions = this.config.transitions
    if (!transitions) {
      // Generate default transitions for each clip boundary
      transitions = Array(clipPaths.length - 1).fill(null).map(() => ({
        type: defaultTransition,
        duration: transitionDuration,
      }))
    }

    // Concatenate clips with transitions
    await concatenateClipsWithTransitions({
      clipPaths,
      outputPath,
      transitions,
      defaultTransition,
      transitionDuration,
    })

    // Verify output was created
    if (!existsSync(outputPath)) {
      throw new Error(`Failed to create compiled video at ${outputPath}`)
    }

    // Return updated context with compiled clip path
    return {
      ...context,
      compiledClipPath: outputPath,
      tempFiles: [...(context.tempFiles || []), outputPath],
    }
  }

  async validate(context: PipelineContext): Promise<boolean> {
    const { captionedClips, reframedClips } = context
    const clipsToCompile = captionedClips || reframedClips
    return !!(clipsToCompile && clipsToCompile.length > 0)
  }

  async cleanup(context: PipelineContext): Promise<void> {
    // Clean up temporary files if needed
    if (context.compiledClipPath && existsSync(context.compiledClipPath)) {
      const { unlink } = await import('fs/promises')
      await unlink(context.compiledClipPath)
    }
  }
}

/**
 * Legacy auto-zoom effects stage (for backward compatibility)
 * This can be used independently for applying zoom effects to individual clips
 */
export const effectsStage: PipelineStage = {
  name: 'effects',
  execute: async (context: PipelineContext): Promise<PipelineContext> => {
    const { reframedClipsDir, reframedClips, settings, moments } = context

    if (!reframedClipsDir) {
      throw new Error('reframedClipsDir not found in context. Reframe stage must run first.')
    }

    if (!reframedClips || reframedClips.length === 0) {
      throw new Error('No reframed clips found in context.')
    }

    // Check if auto-zoom is enabled
    const autoZoomEnabled = settings?.autoZoom ?? true // Default to enabled

    if (!autoZoomEnabled) {
      console.log('[Effects] Auto-zoom disabled, skipping effects stage')
      return {
        ...context,
        effectsClips: reframedClips, // Pass through unchanged
        currentStage: 'effects',
        progress: 70,
      }
    }

    // Get zoom configuration
    const zoomIntensity: 'subtle' | 'medium' | 'strong' = settings?.zoomIntensity || 'medium'
    const maxZoom = ZOOM_INTENSITY_MAP[zoomIntensity]

    console.log(`[Effects] Processing ${reframedClips.length} clips with auto-zoom (intensity: ${zoomIntensity}, max: ${maxZoom}x)`)

    // Create output directory for effects
    const effectsClipsDir = reframedClipsDir.replace('/reframed/', '/effects/')
    const { mkdirSync } = await import('fs')
    mkdirSync(effectsClipsDir, { recursive: true })

    // Process each clip
    const results = []
    for (let i = 0; i < reframedClips.length; i++) {
      const clip = reframedClips[i]
      const inputPath = clip.path
      const outputPath = join(effectsClipsDir, basename(clip.path))

      console.log(`[Effects] ${i + 1}/${reframedClips.length}: ${basename(clip.path)}`)

      try {
        // Get clip duration to map audio moments
        const clipStartTime = await getClipStartTime(clip.originalPath, context)
        const clipDuration = await getVideoDuration(inputPath)

        // Filter audio moments that occur during this clip
        const clipMoments = filterMomentsForClip(moments || [], clipStartTime, clipDuration)

        if (clipMoments.length === 0) {
          console.log(`[Effects] No audio peaks in clip, skipping zoom effects`)
          // Copy file as-is
          await $`cp ${inputPath} ${outputPath}`
        } else {
          console.log(`[Effects] Found ${clipMoments.length} audio peaks in clip`)

          // Get face tracking data if available
          const faceKeyframes = context.metadata?.faceKeyframes as CropKeyframe[] | undefined

          // Apply zoom effects
          await applyAutoZoom({
            inputPath,
            outputPath,
            moments: clipMoments,
            clipStartTime,
            maxZoom,
            faceKeyframes,
          })
        }

        results.push({
          path: outputPath,
          originalPath: clip.originalPath,
          clipId: clip.clipId,
        })

        // Update progress
        const progress = Math.round(60 + ((i + 1) / reframedClips.length) * 10)
        console.log(`[Effects] Progress: ${progress}%`)
      } catch (error) {
        console.error(`[Effects] Failed to process ${basename(clip.path)}:`, error)
        throw new Error(`Failed to apply effects to ${basename(clip.path)}: ${error}`)
      }
    }

    console.log(`[Effects] Completed ${results.length} clips`)

    return {
      ...context,
      effectsClipsDir,
      effectsClips: results,
      currentStage: 'effects',
      progress: 70,
    }
  },
}

/**
 * Apply auto-zoom effect to a video based on audio moments
 */
async function applyAutoZoom(config: {
  inputPath: string
  outputPath: string
  moments: SignalMoment[]
  clipStartTime: number
  maxZoom: number
  faceKeyframes?: CropKeyframe[]
}): Promise<void> {
  const { inputPath, outputPath, moments, clipStartTime, maxZoom, faceKeyframes } = config

  // Get video dimensions
  const dimsResult = await $`ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=s=x:p=0 ${inputPath}`.text()

  const [width, height] = dimsResult.trim().split('x').map(Number)

  // Generate zoom keyframes from audio moments
  const zoomKeyframes = generateZoomKeyframes(moments, clipStartTime, maxZoom, faceKeyframes, width, height)

  if (zoomKeyframes.length === 0) {
    // No zoom needed, copy as-is
    await $`cp ${inputPath} ${outputPath}`
    return
  }

  // Build FFmpeg zoompan filter
  const zoomFilter = buildZoomPanFilter(zoomKeyframes, width, height)

  console.log(`[Effects] Applying zoom filter: ${zoomFilter.substring(0, 100)}...`)

  // Apply zoom effect with FFmpeg
  await $`ffmpeg -i ${inputPath} \
    -vf "${zoomFilter}" \
    -c:v libx264 -crf 20 -preset medium \
    -c:a copy \
    -y ${outputPath}`
}

/**
 * Generate zoom keyframes from audio moments
 */
function generateZoomKeyframes(
  moments: SignalMoment[],
  clipStartTime: number,
  maxZoom: number,
  faceKeyframes?: CropKeyframe[],
  videoWidth?: number,
  videoHeight?: number
): ZoomKeyframe[] {
  const keyframes: ZoomKeyframe[] = []

  const zoomMoments = moments.filter(m => {
    const audio = m.signals?.audio as any
    return audio && (audio.type === 'peak' || audio.type === 'sustained')
  })

  for (const moment of zoomMoments) {
    // Convert absolute timestamp to clip-relative time
    const relativeTime = moment.timestamp - clipStartTime

    if (relativeTime < 0) continue // Skip moments before clip starts

    // Get face position at this moment if available
    let faceX: number | undefined
    let faceY: number | undefined

    if (faceKeyframes && faceKeyframes.length > 0 && videoWidth && videoHeight) {
      const faceAtMoment = getFacePositionAtTime(faceKeyframes, relativeTime)
      if (faceAtMoment) {
        // Calculate face center as a fraction of video dimensions
        faceX = (faceAtMoment.x + faceAtMoment.width / 2) / videoWidth
        faceY = (faceAtMoment.y + faceAtMoment.height / 2) / videoHeight
      }
    }

    // Create zoom sequence: zoom in -> hold -> zoom out
    const zoomInStart = relativeTime
    const zoomInEnd = relativeTime + DEFAULT_ZOOM_DURATION
    const zoomHoldEnd = zoomInEnd + DEFAULT_ZOOM_HOLD
    const zoomOutEnd = zoomHoldEnd + DEFAULT_ZOOM_DURATION

    // Add keyframes for this moment
    keyframes.push(
      { time: zoomInStart, zoom: 1.0, x: faceX, y: faceY }, // Start at normal
      { time: zoomInEnd, zoom: maxZoom, x: faceX, y: faceY }, // Zoom in
      { time: zoomHoldEnd, zoom: maxZoom, x: faceX, y: faceY }, // Hold
      { time: zoomOutEnd, zoom: 1.0, x: faceX, y: faceY } // Zoom out
    )
  }

  // Sort by time and remove duplicates
  keyframes.sort((a, b) => a.time - b.time)

  return keyframes
}

/**
 * Get face position at a specific time by interpolating keyframes
 */
function getFacePositionAtTime(
  faceKeyframes: CropKeyframe[],
  time: number
): CropKeyframe | undefined {
  if (faceKeyframes.length === 0) return undefined

  // Find the keyframe at or before this time
  let prevKeyframe = faceKeyframes[0]
  let nextKeyframe = faceKeyframes[0]

  for (let i = 0; i < faceKeyframes.length; i++) {
    if (faceKeyframes[i].time <= time) {
      prevKeyframe = faceKeyframes[i]
    }
    if (faceKeyframes[i].time > time) {
      nextKeyframe = faceKeyframes[i]
      break
    }
  }

  // If same keyframe, return it
  if (prevKeyframe === nextKeyframe) {
    return prevKeyframe
  }

  // Linear interpolation between keyframes
  const t = (time - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time)
  return {
    time,
    x: Math.round(prevKeyframe.x + (nextKeyframe.x - prevKeyframe.x) * t),
    y: Math.round(prevKeyframe.y + (nextKeyframe.y - prevKeyframe.y) * t),
    width: Math.round(prevKeyframe.width + (nextKeyframe.width - prevKeyframe.width) * t),
    height: Math.round(prevKeyframe.height + (nextKeyframe.height - prevKeyframe.height) * t),
  }
}

/**
 * Build FFmpeg zoompan filter expression from zoom keyframes
 */
function buildZoomPanFilter(keyframes: ZoomKeyframe[], width: number, height: number): string {
  if (keyframes.length === 0) {
    return 'null' // No zoom effect
  }

  // Build zoom expression with interpolation
  const zoomExpr = buildZoomExpression(keyframes)

  // Build pan expressions (x and y)
  const xExpr = buildPanExpression(keyframes, width, height, 'x')
  const yExpr = buildPanExpression(keyframes, width, height, 'y')

  // Construct zoompan filter
  // zoompan parameters:
  // - z: zoom factor expression
  // - x: x position expression
  // - y: y position expression
  // - d: duration in frames (1 = apply every frame)
  // - s: output size

  return `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${width}x${height}`
}

/**
 * Build zoom factor expression for FFmpeg
 */
function buildZoomExpression(keyframes: ZoomKeyframe[]): string {
  if (keyframes.length === 0) {
    return '1.0'
  }

  if (keyframes.length === 1) {
    return String(keyframes[0].zoom)
  }

  // Build nested if statements for linear interpolation between keyframes
  let expr = String(keyframes[keyframes.length - 1].zoom)

  for (let i = keyframes.length - 2; i >= 0; i--) {
    const curr = keyframes[i]
    const next = keyframes[i + 1]

    if (next.time === curr.time) {
      // Same time, use current value
      expr = `if(gte(time,${curr.time}),${next.zoom},${expr})`
    } else {
      // Linear interpolation
      const slope = (next.zoom - curr.zoom) / (next.time - curr.time)
      const interpolation = `${curr.zoom}+(time-${curr.time})*${slope}`

      expr = `if(lt(time,${next.time}),${interpolation},${expr})`
    }
  }

  return expr
}

/**
 * Build pan expression for x or y coordinate
 */
function buildPanExpression(
  keyframes: ZoomKeyframe[],
  width: number,
  height: number,
  axis: 'x' | 'y'
): string {
  // Default to center if no face tracking
  const hasFaceTracking = keyframes.some(kf => kf.x !== undefined && kf.y !== undefined)

  if (!hasFaceTracking) {
    // Center pan (standard zoompan behavior)
    if (axis === 'x') {
      return 'iw/2-(iw/zoom/2)'
    } else {
      return 'ih/2-(ih/zoom/2)'
    }
  }

  // Build expression for face-aware panning
  // Pan to keep face centered as we zoom
  const varName = axis === 'x' ? 'iw' : 'ih'

  // Build interpolation for face position
  let faceExpr = '0.5' // Default to center

  if (keyframes.length > 0) {
    // Build nested if for face position interpolation
    const positions = keyframes.map(kf => axis === 'x' ? kf.x : kf.y)

    if (positions.every(p => p !== undefined)) {
      faceExpr = buildFacePositionExpression(keyframes, axis)
    }
  }

  // Pan formula: center - (zoom_offset) + (face_offset)
  // This keeps the face centered while zooming
  return `${varName}/2-(${varName}/zoom/2)+(${faceExpr}-0.5)*${varName}/zoom`
}

/**
 * Build face position expression (0.0 to 1.0 normalized)
 */
function buildFacePositionExpression(keyframes: ZoomKeyframe[], axis: 'x' | 'y'): string {
  if (keyframes.length === 0) {
    return '0.5'
  }

  const positions = keyframes.map(kf => axis === 'x' ? kf.x : kf.y)

  if (positions.every(p => p === undefined)) {
    return '0.5' // No face data, default to center
  }

  if (keyframes.length === 1) {
    return String(positions[0] ?? 0.5)
  }

  // Build interpolation expression
  let expr = String(positions[positions.length - 1] ?? 0.5)

  for (let i = keyframes.length - 2; i >= 0; i--) {
    const curr = keyframes[i]
    const next = keyframes[i + 1]
    const currPos = positions[i] ?? 0.5
    const nextPos = positions[i + 1] ?? 0.5

    if (next.time === curr.time) {
      expr = `if(gte(time,${curr.time}),${nextPos},${expr})`
    } else {
      const slope = (nextPos - currPos) / (next.time - curr.time)
      const interpolation = `${currPos}+(time-${curr.time})*${slope}`

      expr = `if(lt(time,${next.time}),${interpolation},${expr})`
    }
  }

  return expr
}

/**
 * Filter audio moments that occur during a specific clip
 */
function filterMomentsForClip(
  moments: SignalMoment[],
  clipStartTime: number,
  clipDuration: number
): SignalMoment[] {
  const clipEndTime = clipStartTime + clipDuration

  return moments.filter(moment =>
    moment.timestamp >= clipStartTime && moment.timestamp < clipEndTime
  )
}

/**
 * Get clip start time from extracted clips context
 */
async function getClipStartTime(
  originalPath: string,
  context: PipelineContext
): Promise<number> {
  // Find the extracted clip info
  const extractedClip = context.extractedClips?.find(c => c.path === originalPath)

  return extractedClip?.startTime ?? 0
}

/**
 * Get video duration in seconds
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  const result = await $`ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 ${videoPath}`.text()

  return parseFloat(result.trim())
}

/**
 * Export default for convenience
 */
export default effectsStage
