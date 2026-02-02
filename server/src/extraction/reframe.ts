/**
 * Vertical Reframing Module
 *
 * Converts horizontal (16:9) clips to vertical (9:16) format
 * using intelligent cropping based on face detection and motion.
 */

import { $ } from 'bun'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import { mkdir, unlink } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export type AspectRatio = '9:16' | '1:1' | '16:9' | '4:5'

export interface ReframeConfig {
  inputPath: string
  outputPath: string
  targetAspect: AspectRatio
  faceTracking?: boolean
  smoothing?: number // 0-1, how smooth the pan should be
}

export interface CropKeyframe {
  time: number // seconds
  x: number // crop x offset
  y: number // crop y offset
  width: number
  height: number
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
      keyframes = await detectFacesForReframe(inputPath, cropWidth, cropHeight, sourceWidth, sourceHeight)
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
 * Uses MediaPipe Face Detection for accurate face tracking
 */
async function detectFacesForReframe(
  inputPath: string,
  cropWidth: number,
  cropHeight: number,
  sourceWidth: number,
  sourceHeight: number
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

    const keyframes: CropKeyframe[] = []

    // Process each frame
    for (let i = 0; i < frameFiles.length; i++) {
      const framePath = join(tmpDir, frameFiles[i])
      const timestamp = i / 2 // 2 FPS means each frame is 0.5 seconds apart

      try {
        // Read frame as ImageData for MediaPipe
        const image = await loadImageFromFile(framePath)
        const detections = detector.detect(image)

        if (detections.detections.length > 0) {
          // Get the first (most prominent) face
          const face = detections.detections[0]
          const bbox = face.boundingBox

          if (bbox) {
            // Calculate face center in source coordinates
            const faceCenterX = (bbox.originX + bbox.width / 2) * sourceWidth
            const faceCenterY = (bbox.originY + bbox.height / 2) * sourceHeight

            // Calculate crop position to center the face
            let cropX = Math.round(faceCenterX - cropWidth / 2)
            let cropY = Math.round(faceCenterY - cropHeight / 2)

            // Clamp to valid bounds
            cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth))
            cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight))

            keyframes.push({
              time: timestamp,
              x: cropX,
              y: cropY,
              width: cropWidth,
              height: cropHeight,
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

    return keyframes
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
  } = {}
): Promise<void> {
  const { facecamRatio = 0.35, targetAspect = '9:16' } = options
  const dims = ASPECT_DIMENSIONS[targetAspect]
  
  const facecamHeight = Math.round(dims.height * facecamRatio)
  const gameplayHeight = dims.height - facecamHeight
  
  await $`ffmpeg -i ${gameplayPath} -i ${facecamPath} \
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
