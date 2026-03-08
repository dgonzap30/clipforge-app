/**
 * Vertical Reframing Module
 *
 * Converts horizontal (16:9) clips to vertical (9:16) format
 * using intelligent cropping based on face detection and motion.
 */

import { $ } from 'bun'
import type { AudioMoment } from '../analysis/audio'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { mkdir, unlink } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export type AspectRatio = '9:16' | '1:1' | '16:9' | '4:5'
export type FaceSelectionStrategy = 'largest' | 'speaker' | 'center'

export interface ReframeConfig {
  inputPath: string
  outputPath: string
  targetAspect: AspectRatio
  faceTracking?: boolean
  smoothing?: number // 0-1, how smooth the pan should be
  faceStrategy?: FaceSelectionStrategy
  audioMoments?: AudioMoment[] // For speaker prioritization
}

export interface CropKeyframe {
  time: number // seconds
  x: number // crop x offset
  y: number // crop y offset
  width: number
  height: number
}

export interface DetectedFace {
  timestamp: number // seconds
  x: number // bounding box x
  y: number // bounding box y
  width: number
  height: number
  confidence: number // 0-1
  trackingId?: number // For persistence across frames
}

export interface FaceTrack {
  trackingId: number
  faces: DetectedFace[]
  lastSeen: number
  speakerScore: number // Correlation with audio moments
}

export interface ReframeResult {
  outputPath: string
  keyframes: CropKeyframe[]
  method: 'face_tracking' | 'center_crop' | 'motion_tracking'
}

// Aspect ratio dimensions (for 1080p output)
const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
}

/**
 * Reframe video to target aspect ratio
 * 
 * Strategy:
 * 1. If face detected: Track face and keep it in frame
 * 2. If no face: Use center crop with slight motion following
 */
export async function reframeVideo(config: ReframeConfig): Promise<ReframeResult> {
  const {
    inputPath,
    outputPath,
    targetAspect,
    faceTracking = true,
    smoothing = 0.7,
    faceStrategy = 'largest',
    audioMoments = [],
  } = config
  
  const targetDims = ASPECT_DIMENSIONS[targetAspect]
  
  // Get source dimensions
  const sourceResult = await $`ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=s=x:p=0 ${inputPath}`.text()
  
  const [sourceWidth, sourceHeight] = sourceResult.trim().split('x').map(Number)
  
  // Calculate crop dimensions to match target aspect ratio
  const targetRatio = targetDims.width / targetDims.height
  const sourceRatio = sourceWidth / sourceHeight
  
  let cropWidth: number
  let cropHeight: number
  
  if (sourceRatio > targetRatio) {
    // Source is wider, crop sides
    cropHeight = sourceHeight
    cropWidth = Math.round(sourceHeight * targetRatio)
  } else {
    // Source is taller, crop top/bottom
    cropWidth = sourceWidth
    cropHeight = Math.round(sourceWidth / targetRatio)
  }
  
  let keyframes: CropKeyframe[] = []
  let method: ReframeResult['method'] = 'center_crop'
  
  if (faceTracking) {
    try {
      // Try face detection
      keyframes = await detectFacesForReframe(
        inputPath,
        cropWidth,
        cropHeight,
        sourceWidth,
        sourceHeight,
        faceStrategy,
        audioMoments
      )
      if (keyframes.length > 0) {
        method = 'face_tracking'
      }
    } catch (err) {
      console.warn('Face detection failed, falling back to center crop:', err)
    }
  }
  
  // Fall back to center crop if no face keyframes
  if (keyframes.length === 0) {
    const centerX = Math.round((sourceWidth - cropWidth) / 2)
    const centerY = Math.round((sourceHeight - cropHeight) / 2)
    
    keyframes = [{
      time: 0,
      x: centerX,
      y: centerY,
      width: cropWidth,
      height: cropHeight,
    }]
  }
  
  // Apply smoothing to keyframes
  if (smoothing > 0 && keyframes.length > 1) {
    keyframes = smoothKeyframes(keyframes, smoothing)
  }
  
  // Build FFmpeg crop filter
  const cropFilter = buildCropFilter(keyframes, cropWidth, cropHeight, sourceWidth, sourceHeight)
  
  // Apply reframe with FFmpeg
  await $`ffmpeg -i ${inputPath} \
    -vf "${cropFilter},scale=${targetDims.width}:${targetDims.height}" \
    -c:v libx264 -crf 20 -preset medium \
    -c:a copy \
    -y ${outputPath}`
  
  return {
    outputPath,
    keyframes,
    method,
  }
}

/**
 * Detect faces and generate keyframes for cropping
 *
 * Uses MediaPipe Face Detection for accurate face tracking with multi-face handling
 */
async function detectFacesForReframe(
  inputPath: string,
  cropWidth: number,
  cropHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  strategy: FaceSelectionStrategy = 'largest',
  audioMoments: AudioMoment[] = []
): Promise<CropKeyframe[]> {
  // Create temporary directory for frames
  const tmpDir = join(tmpdir(), `reframe-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })

  try {
    // Extract frames at 2 FPS using FFmpeg
    await $`ffmpeg -i ${inputPath} -vf "fps=2" ${tmpDir}/frame-%04d.jpg -y`

    // Initialize MediaPipe Face Detector
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
    )

    const detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      },
      runningMode: 'IMAGE',
    })

    // Read all extracted frames
    const frameFiles = (await readdir(tmpDir))
      .filter((f) => f.endsWith('.jpg'))
      .sort()

    const detectedFaces: DetectedFace[] = []

    // Process each frame
    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = join(tmpDir, frameFiles[i])
      const timestamp = i / 2 // 2 FPS means each frame is 0.5 seconds apart

      try {
        // Read frame as ImageData for MediaPipe
        const image = await loadImageFromFile(framePath)
        const detections = detector.detect(image)

        // Store all detected faces with timestamps
        for (const detection of detections.detections) {
          const bbox = detection.boundingBox
          if (bbox) {
            detectedFaces.push({
              timestamp,
              x: bbox.originX * sourceWidth,
              y: bbox.originY * sourceHeight,
              width: bbox.width * sourceWidth,
              height: bbox.height * sourceHeight,
              confidence: detection.categories?.[0]?.score || 0.5,
            })
          }
        }
      } catch (err) {
        console.warn(`Failed to process frame ${frameFiles[i]}:`, err)
        // Continue to next frame
      }

      // Clean up frame file
      await unlink(framePath).catch(() => {})
    }

    detector.close()

    if (detectedFaces.length === 0) {
      return []
    }

    // Apply multi-face handling and speaker prioritization
    const tracks = buildFaceTracks(detectedFaces)
    const selectedTrack = selectBestTrack(tracks, strategy, audioMoments)

    if (!selectedTrack) {
      return []
    }

    // Convert selected track to crop keyframes
    return convertFaceTrackToKeyframes(
      selectedTrack,
      cropWidth,
      cropHeight,
      sourceWidth,
      sourceHeight
    )
  } catch (err) {
    console.error('Face detection failed:', err)
    return []
  } finally {
    // Clean up temporary directory
    try {
      await $`rm -rf ${tmpDir}`
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Load image from file for MediaPipe processing
 */
async function loadImageFromFile(framePath: string): Promise<ImageData> {
  // Use FFmpeg to get raw RGBA data
  const result = await $`ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=s=x:p=0 ${framePath}`.text()

  const [width, height] = result.trim().split('x').map(Number)

  // Extract raw RGBA pixel data
  const rawData = await $`ffmpeg -i ${framePath} -f rawvideo -pix_fmt rgba -`.arrayBuffer()

  // Create ImageData
  return {
    width,
    height,
    data: new Uint8ClampedArray(rawData),
    colorSpace: 'srgb',
  }
}

/**
 * Build face tracks from detected faces using IOU-based tracking
 */
function buildFaceTracks(faces: DetectedFace[]): FaceTrack[] {
  const tracks: FaceTrack[] = []
  let nextTrackId = 0

  // Sort faces by timestamp
  const sortedFaces = [...faces].sort((a, b) => a.timestamp - b.timestamp)

  for (const face of sortedFaces) {
    // Find existing track that matches this face
    let matchedTrack: FaceTrack | null = null
    let bestIOU = 0

    for (const track of tracks) {
      // Only consider tracks that were seen recently (within 1 second)
      if (face.timestamp - track.lastSeen > 1) {
        continue
      }

      // Get the last face in the track
      const lastFace = track.faces[track.faces.length - 1]

      // Calculate IOU (Intersection Over Union)
      const iou = calculateIOU(face, lastFace)

      if (iou > bestIOU && iou > 0.3) {
        bestIOU = iou
        matchedTrack = track
      }
    }

    if (matchedTrack) {
      // Add face to existing track
      face.trackingId = matchedTrack.trackingId
      matchedTrack.faces.push(face)
      matchedTrack.lastSeen = face.timestamp
    } else {
      // Create new track
      const trackingId = nextTrackId++
      face.trackingId = trackingId
      tracks.push({
        trackingId,
        faces: [face],
        lastSeen: face.timestamp,
        speakerScore: 0,
      })
    }
  }

  return tracks
}

/**
 * Calculate Intersection Over Union for two face bounding boxes
 */
function calculateIOU(face1: DetectedFace, face2: DetectedFace): number {
  const x1 = Math.max(face1.x, face2.x)
  const y1 = Math.max(face1.y, face2.y)
  const x2 = Math.min(face1.x + face1.width, face2.x + face2.width)
  const y2 = Math.min(face1.y + face1.height, face2.y + face2.height)

  if (x2 < x1 || y2 < y1) {
    return 0
  }

  const intersection = (x2 - x1) * (y2 - y1)
  const area1 = face1.width * face1.height
  const area2 = face2.width * face2.height
  const union = area1 + area2 - intersection

  return intersection / union
}

/**
 * Select the best face track based on strategy
 */
function selectBestTrack(
  tracks: FaceTrack[],
  strategy: FaceSelectionStrategy,
  audioMoments: AudioMoment[]
): FaceTrack | null {
  if (tracks.length === 0) {
    return null
  }

  if (tracks.length === 1) {
    return tracks[0]
  }

  switch (strategy) {
    case 'largest':
      return selectLargestTrack(tracks)
    case 'speaker':
      return selectSpeakerTrack(tracks, audioMoments)
    case 'center':
      return selectCenterTrack(tracks)
    default:
      return selectLargestTrack(tracks)
  }
}

/**
 * Select track with largest average face size
 */
function selectLargestTrack(tracks: FaceTrack[]): FaceTrack {
  let bestTrack = tracks[0]
  let bestAvgArea = 0

  for (const track of tracks) {
    const avgArea =
      track.faces.reduce((sum, face) => sum + face.width * face.height, 0) /
      track.faces.length

    if (avgArea > bestAvgArea) {
      bestAvgArea = avgArea
      bestTrack = track
    }
  }

  return bestTrack
}

/**
 * Select track that best correlates with audio moments (speaker)
 */
function selectSpeakerTrack(
  tracks: FaceTrack[],
  audioMoments: AudioMoment[]
): FaceTrack {
  if (audioMoments.length === 0) {
    // Fall back to largest if no audio data
    return selectLargestTrack(tracks)
  }

  // Calculate speaker score for each track
  for (const track of tracks) {
    let score = 0

    for (const face of track.faces) {
      // Find audio moments near this face timestamp (within 0.5s)
      const nearbyMoments = audioMoments.filter(
        (m) => Math.abs(m.timestamp - face.timestamp) < 0.5
      )

      if (nearbyMoments.length > 0) {
        // Weight by audio moment score and proximity
        for (const moment of nearbyMoments) {
          const proximity = 1 - Math.abs(moment.timestamp - face.timestamp) / 0.5
          score += moment.hydeScore * proximity
        }
      }
    }

    track.speakerScore = score / Math.max(track.faces.length, 1)
  }

  // Select track with highest speaker score
  let bestTrack = tracks[0]
  let bestScore = tracks[0].speakerScore

  for (const track of tracks) {
    if (track.speakerScore > bestScore) {
      bestScore = track.speakerScore
      bestTrack = track
    }
  }

  // If no track has audio correlation, fall back to largest
  if (bestScore === 0) {
    return selectLargestTrack(tracks)
  }

  return bestTrack
}

/**
 * Select track closest to center of frame
 */
function selectCenterTrack(tracks: FaceTrack[]): FaceTrack {
  let bestTrack = tracks[0]
  let bestAvgDistanceToCenter = Infinity

  for (const track of tracks) {
    const avgDistanceToCenter =
      track.faces.reduce((sum, face) => {
        const faceCenterX = face.x + face.width / 2
        const faceCenterY = face.y + face.height / 2
        // Assume typical video dimensions for center calculation
        const centerX = 1920 / 2
        const centerY = 1080 / 2
        const distance = Math.sqrt(
          Math.pow(faceCenterX - centerX, 2) + Math.pow(faceCenterY - centerY, 2)
        )
        return sum + distance
      }, 0) / track.faces.length

    if (avgDistanceToCenter < bestAvgDistanceToCenter) {
      bestAvgDistanceToCenter = avgDistanceToCenter
      bestTrack = track
    }
  }

  return bestTrack
}

/**
 * Convert face track to crop keyframes
 */
function convertFaceTrackToKeyframes(
  track: FaceTrack,
  cropWidth: number,
  cropHeight: number,
  sourceWidth: number,
  sourceHeight: number
): CropKeyframe[] {
  const keyframes: CropKeyframe[] = []

  for (const face of track.faces) {
    // Center crop on face
    const faceCenterX = face.x + face.width / 2
    const faceCenterY = face.y + face.height / 2

    // Calculate crop position to center on face
    let cropX = Math.round(faceCenterX - cropWidth / 2)
    let cropY = Math.round(faceCenterY - cropHeight / 2)

    // Clamp to source bounds
    cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth))
    cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight))

    keyframes.push({
      time: face.timestamp,
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    })
  }

  return keyframes
}

/**
 * Smooth keyframes to avoid jerky motion
 */
function smoothKeyframes(keyframes: CropKeyframe[], smoothing: number): CropKeyframe[] {
  if (keyframes.length <= 1) return keyframes
  
  const smoothed: CropKeyframe[] = [keyframes[0]]
  const alpha = 1 - smoothing
  
  for (let i = 1; i < keyframes.length; i++) {
    const prev = smoothed[i - 1]
    const curr = keyframes[i]
    
    smoothed.push({
      time: curr.time,
      x: Math.round(prev.x * smoothing + curr.x * alpha),
      y: Math.round(prev.y * smoothing + curr.y * alpha),
      width: curr.width,
      height: curr.height,
    })
  }
  
  return smoothed
}

/**
 * Build FFmpeg crop filter expression from keyframes
 */
function buildCropFilter(
  keyframes: CropKeyframe[],
  cropWidth: number,
  cropHeight: number,
  _sourceWidth: number,
  _sourceHeight: number
): string {
  if (keyframes.length === 1) {
    // Static crop
    const kf = keyframes[0]
    return `crop=${cropWidth}:${cropHeight}:${kf.x}:${kf.y}`
  }

  // Dynamic crop with interpolation
  // Build expression for x and y based on time
  const xExpr = buildInterpolationExpr(keyframes, 'x', 't')
  const yExpr = buildInterpolationExpr(keyframes, 'y', 't')

  return `crop=${cropWidth}:${cropHeight}:${xExpr}:${yExpr}`
}

/**
 * Build interpolation expression for FFmpeg
 */
function buildInterpolationExpr(
  keyframes: CropKeyframe[],
  prop: 'x' | 'y',
  timeVar: string
): string {
  if (keyframes.length === 1) {
    return String(keyframes[0][prop])
  }
  
  // Build nested if statements for linear interpolation
  let expr = String(keyframes[keyframes.length - 1][prop])
  
  for (let i = keyframes.length - 2; i >= 0; i--) {
    const curr = keyframes[i]
    const next = keyframes[i + 1]
    
    // Linear interpolation between curr and next
    const slope = (next[prop] - curr[prop]) / (next.time - curr.time)
    const intercept = curr[prop] - slope * curr.time
    
    expr = `if(lt(${timeVar},${next.time}),${slope}*${timeVar}+${intercept},${expr})`
  }
  
  return expr
}

/**
 * Create split-screen layout (face cam top, gameplay bottom)
 */
export async function createSplitScreen(
  gameplayPath: string,
  facecamPath: string,
  outputPath: string,
  options: {
    facecamRatio?: number // 0-1, how much of screen facecam takes
    targetAspect?: AspectRatio
    startTime?: number // Seconds
    duration?: number // Seconds
  } = {}
): Promise<void> {
  const { facecamRatio = 0.35, targetAspect = '9:16', startTime = 0, duration } = options
  const dims = ASPECT_DIMENSIONS[targetAspect]
  
  const facecamHeight = Math.round(dims.height * facecamRatio)
  const gameplayHeight = dims.height - facecamHeight
  
  // Build input arguments
  // If startTime/duration provided, apply to BOTH inputs to sync them
  const inputArgs: string[] = []
  
  // Gameplay input
  if (startTime > 0) inputArgs.push('-ss', startTime.toString())
  if (duration) inputArgs.push('-t', duration.toString())
  inputArgs.push('-i', gameplayPath)
  
  // Facecam input
  if (startTime > 0) inputArgs.push('-ss', startTime.toString())
  if (duration) inputArgs.push('-t', duration.toString())
  inputArgs.push('-i', facecamPath)

  await $`ffmpeg ${inputArgs} \
    -filter_complex "
      [0:v]scale=${dims.width}:${gameplayHeight},setsar=1[gameplay];
      [1:v]scale=${dims.width}:${facecamHeight},setsar=1[facecam];
      [facecam][gameplay]vstack=inputs=2[out]
    " \
    -map "[out]" -map 0:a \
    -c:v libx264 -crf 20 \
    -c:a copy \
    -y ${outputPath}`
}
