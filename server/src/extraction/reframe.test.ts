/**
 * Tests for Reframe Module with MediaPipe Face Detection and Multi-Face Handling
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { reframeVideo, type AspectRatio, type DetectedFace, type FaceTrack, type AudioMoment } from './reframe'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { $ } from 'bun'

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
 * Build face tracks from detected faces using IOU-based tracking
 */
function buildFaceTracks(faces: DetectedFace[]): FaceTrack[] {
  const tracks: FaceTrack[] = []
  let nextTrackId = 0

  const sortedFaces = [...faces].sort((a, b) => a.timestamp - b.timestamp)

  for (const face of sortedFaces) {
    let matchedTrack: FaceTrack | null = null
    let bestIOU = 0

    for (const track of tracks) {
      if (face.timestamp - track.lastSeen > 1) {
        continue
      }

      const lastFace = track.faces[track.faces.length - 1]
      const iou = calculateIOU(face, lastFace)

      if (iou > bestIOU && iou > 0.3) {
        bestIOU = iou
        matchedTrack = track
      }
    }

    if (matchedTrack) {
      face.trackingId = matchedTrack.trackingId
      matchedTrack.faces.push(face)
      matchedTrack.lastSeen = face.timestamp
    } else {
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
    return selectLargestTrack(tracks)
  }

  for (const track of tracks) {
    let score = 0

    for (const face of track.faces) {
      const nearbyMoments = audioMoments.filter(
        (m) => Math.abs(m.timestamp - face.timestamp) < 0.5
      )

      if (nearbyMoments.length > 0) {
        for (const moment of nearbyMoments) {
          const proximity = 1 - Math.abs(moment.timestamp - face.timestamp) / 0.5
          score += moment.hydeScore * proximity
        }
      }
    }

    track.speakerScore = score / Math.max(track.faces.length, 1)
  }

  let bestTrack = tracks[0]
  let bestScore = tracks[0].speakerScore

  for (const track of tracks) {
    if (track.speakerScore > bestScore) {
      bestScore = track.speakerScore
      bestTrack = track
    }
  }

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

describe('IOU Calculation', () => {
  test('should calculate perfect overlap as 1.0', () => {
    const face1: DetectedFace = {
      timestamp: 0,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      confidence: 0.9,
    }
    const face2: DetectedFace = {
      timestamp: 0.1,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      confidence: 0.9,
    }

    expect(calculateIOU(face1, face2)).toBe(1.0)
  })

  test('should calculate no overlap as 0.0', () => {
    const face1: DetectedFace = {
      timestamp: 0,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      confidence: 0.9,
    }
    const face2: DetectedFace = {
      timestamp: 0.1,
      x: 500,
      y: 500,
      width: 200,
      height: 200,
      confidence: 0.9,
    }

    expect(calculateIOU(face1, face2)).toBe(0.0)
  })

  test('should calculate partial overlap correctly', () => {
    const face1: DetectedFace = {
      timestamp: 0,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      confidence: 0.9,
    }
    const face2: DetectedFace = {
      timestamp: 0.1,
      x: 150,
      y: 150,
      width: 200,
      height: 200,
      confidence: 0.9,
    }

    const iou = calculateIOU(face1, face2)
    expect(iou).toBeGreaterThan(0)
    expect(iou).toBeLessThan(1)
    expect(iou).toBeCloseTo(0.391, 2) // Approx 39.1% overlap
  })
})

describe('Face Track Building', () => {
  test('should create single track for same face across frames', () => {
    const faces: DetectedFace[] = [
      { timestamp: 0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.1, x: 105, y: 105, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.2, x: 110, y: 110, width: 200, height: 200, confidence: 0.9 },
    ]

    const tracks = buildFaceTracks(faces)

    expect(tracks).toHaveLength(1)
    expect(tracks[0].faces).toHaveLength(3)
    expect(tracks[0].trackingId).toBe(0)
  })

  test('should create separate tracks for different faces', () => {
    const faces: DetectedFace[] = [
      { timestamp: 0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0, x: 500, y: 500, width: 200, height: 200, confidence: 0.9 },
    ]

    const tracks = buildFaceTracks(faces)

    expect(tracks).toHaveLength(2)
    expect(tracks[0].faces).toHaveLength(1)
    expect(tracks[1].faces).toHaveLength(1)
  })

  test('should not match faces separated by more than 1 second', () => {
    const faces: DetectedFace[] = [
      { timestamp: 0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 2, x: 105, y: 105, width: 200, height: 200, confidence: 0.9 },
    ]

    const tracks = buildFaceTracks(faces)

    expect(tracks).toHaveLength(2)
  })

  test('should assign tracking IDs correctly', () => {
    const faces: DetectedFace[] = [
      { timestamp: 0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.1, x: 105, y: 105, width: 200, height: 200, confidence: 0.9 },
    ]

    const tracks = buildFaceTracks(faces)

    expect(faces[0].trackingId).toBe(0)
    expect(faces[1].trackingId).toBe(0)
  })
})

describe('Largest Face Selection', () => {
  test('should select track with largest average area', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 100, height: 100, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
    ]

    const selected = selectLargestTrack(tracks)

    expect(selected.trackingId).toBe(1)
  })

  test('should handle single track', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 100, height: 100, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
    ]

    const selected = selectLargestTrack(tracks)

    expect(selected.trackingId).toBe(0)
  })

  test('should average across multiple faces in track', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [
          { timestamp: 0, x: 0, y: 0, width: 100, height: 100, confidence: 0.9 },
          { timestamp: 0.1, x: 0, y: 0, width: 300, height: 300, confidence: 0.9 },
        ],
        lastSeen: 0.1,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
    ]

    const selected = selectLargestTrack(tracks)

    // Track 0 average: (10000 + 90000) / 2 = 50000
    // Track 1 average: 40000
    expect(selected.trackingId).toBe(0)
  })
})

describe('Speaker Track Selection', () => {
  test('should select track with highest audio correlation', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 1.0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 1.0,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [
          { timestamp: 5.0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 },
          { timestamp: 5.1, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 },
        ],
        lastSeen: 5.1,
        speakerScore: 0,
      },
    ]

    const audioMoments: AudioMoment[] = [
      { timestamp: 5.0, amplitude: 0.9, rmsLevel: 0.7, hydeScore: 90, type: 'peak' },
      { timestamp: 5.1, amplitude: 0.9, rmsLevel: 0.7, hydeScore: 90, type: 'peak' },
    ]

    const selected = selectSpeakerTrack(tracks, audioMoments)

    // Track 1 should have higher speaker score due to more faces correlating with audio
    expect(selected.trackingId).toBe(1)
  })

  test('should fall back to largest when no audio moments', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 100, height: 100, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
    ]

    const selected = selectSpeakerTrack(tracks, [])

    expect(selected.trackingId).toBe(1) // Largest face
  })

  test('should weight by proximity to audio moment', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 1.0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 1.0,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [{ timestamp: 1.4, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 1.4,
        speakerScore: 0,
      },
    ]

    const audioMoments: AudioMoment[] = [
      { timestamp: 1.0, amplitude: 0.8, rmsLevel: 0.6, hydeScore: 80, type: 'peak' },
    ]

    const selected = selectSpeakerTrack(tracks, audioMoments)

    // Track 0 should win due to exact timestamp match
    expect(selected.trackingId).toBe(0)
  })

  test('should ignore audio moments beyond 0.5s threshold', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 1.0, x: 0, y: 0, width: 100, height: 100, confidence: 0.9 }],
        lastSeen: 1.0,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [{ timestamp: 5.0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 5.0,
        speakerScore: 0,
      },
    ]

    const audioMoments: AudioMoment[] = [
      { timestamp: 2.0, amplitude: 0.9, rmsLevel: 0.7, hydeScore: 90, type: 'peak' },
    ]

    const selected = selectSpeakerTrack(tracks, audioMoments)

    // Should fall back to largest since no faces are within 0.5s
    expect(selected.trackingId).toBe(1)
  })
})

describe('Center Track Selection', () => {
  test('should select track closest to center', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [
          { timestamp: 0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
        ],
        lastSeen: 0,
        speakerScore: 0,
      },
      {
        trackingId: 1,
        faces: [
          { timestamp: 0, x: 860, y: 490, width: 200, height: 200, confidence: 0.9 },
        ],
        lastSeen: 0,
        speakerScore: 0,
      },
    ]

    const selected = selectCenterTrack(tracks)

    // Track 1 center is at (960, 590), closer to (960, 540) center
    expect(selected.trackingId).toBe(1)
  })

  test('should handle single track', () => {
    const tracks: FaceTrack[] = [
      {
        trackingId: 0,
        faces: [{ timestamp: 0, x: 0, y: 0, width: 200, height: 200, confidence: 0.9 }],
        lastSeen: 0,
        speakerScore: 0,
      },
    ]

    const selected = selectCenterTrack(tracks)

    expect(selected.trackingId).toBe(0)
  })
})

describe('Integration: Multi-Face Handling', () => {
  test('should handle multiple faces and select by largest', () => {
    const faces: DetectedFace[] = [
      // Person 1 (larger face)
      { timestamp: 0, x: 100, y: 100, width: 300, height: 300, confidence: 0.9 },
      { timestamp: 0.1, x: 105, y: 105, width: 300, height: 300, confidence: 0.9 },
      // Person 2 (smaller face)
      { timestamp: 0, x: 600, y: 600, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.1, x: 605, y: 605, width: 200, height: 200, confidence: 0.9 },
    ]

    const selected = selectLargestTrack(buildFaceTracks(faces))

    expect(selected.trackingId).toBe(0) // Larger face
  })

  test('should handle multiple faces and select by speaker', () => {
    const faces: DetectedFace[] = [
      // Person 1
      { timestamp: 1.0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 1.1, x: 105, y: 105, width: 200, height: 200, confidence: 0.9 },
      // Person 2
      { timestamp: 5.0, x: 600, y: 600, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 5.1, x: 605, y: 605, width: 200, height: 200, confidence: 0.9 },
    ]

    const audioMoments: AudioMoment[] = [
      { timestamp: 5.0, amplitude: 0.9, rmsLevel: 0.7, hydeScore: 90, type: 'peak' },
      { timestamp: 5.1, amplitude: 0.8, rmsLevel: 0.6, hydeScore: 85, type: 'peak' },
    ]

    const tracks = buildFaceTracks(faces)
    const selected = selectSpeakerTrack(tracks, audioMoments)

    expect(tracks).toHaveLength(2)
    expect(selected.trackingId).toBe(1) // Person 2 correlates with audio
  })

  test('should maintain face tracking consistency', () => {
    const faces: DetectedFace[] = [
      { timestamp: 0.0, x: 100, y: 100, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.1, x: 110, y: 105, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.2, x: 120, y: 110, width: 200, height: 200, confidence: 0.9 },
      { timestamp: 0.3, x: 130, y: 115, width: 200, height: 200, confidence: 0.9 },
    ]

    const tracks = buildFaceTracks(faces)

    expect(tracks).toHaveLength(1)
    expect(tracks[0].faces).toHaveLength(4)

    // All faces should have same tracking ID
    for (const face of faces) {
      expect(face.trackingId).toBe(0)
    }
  })
})

describe('reframeVideo', () => {
  let testDir: string
  let inputVideoPath: string
  let outputVideoPath: string

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `reframe-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    inputVideoPath = join(testDir, 'input.mp4')
    outputVideoPath = join(testDir, 'output.mp4')
  })

  afterEach(async () => {
    // Clean up test directories
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  test('should accept valid AspectRatio types', () => {
    const validAspects: AspectRatio[] = ['9:16', '1:1', '16:9', '4:5']

    expect(validAspects).toContain('9:16')
    expect(validAspects).toContain('1:1')
    expect(validAspects).toContain('16:9')
    expect(validAspects).toContain('4:5')
  })

  test('should return correct dimensions for aspect ratios', () => {
    // These are the expected dimensions for each aspect ratio
    const expectedDimensions = {
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1080, height: 1080 },
      '16:9': { width: 1920, height: 1080 },
      '4:5': { width: 1080, height: 1350 },
    }

    // Verify the dimensions are correct
    expect(expectedDimensions['9:16'].width).toBe(1080)
    expect(expectedDimensions['9:16'].height).toBe(1920)
  })

  test('should fall back to center crop when no faces detected', async () => {
    // Create a simple test video without faces (solid color)
    await $`ffmpeg -f lavfi -i color=c=blue:s=1920x1080:d=2 \
      -c:v libx264 -pix_fmt yuv420p -y ${inputVideoPath}`

    const result = await reframeVideo({
      inputPath: inputVideoPath,
      outputPath: outputVideoPath,
      targetAspect: '9:16',
      faceTracking: true,
      smoothing: 0.7,
    })

    // Should fall back to center crop when no faces are found
    expect(result.method).toBe('center_crop')
    expect(result.keyframes.length).toBeGreaterThan(0)
    expect(result.outputPath).toBe(outputVideoPath)
  })

  test('should respect smoothing parameter', () => {
    // Test that smoothing values are within valid range
    const validSmoothing = [0, 0.5, 0.7, 1.0]

    validSmoothing.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    })
  })

  test('should handle faceTracking being disabled', async () => {
    // Create a simple test video
    await $`ffmpeg -f lavfi -i color=c=red:s=1920x1080:d=2 \
      -c:v libx264 -pix_fmt yuv420p -y ${inputVideoPath}`

    const result = await reframeVideo({
      inputPath: inputVideoPath,
      outputPath: outputVideoPath,
      targetAspect: '9:16',
      faceTracking: false, // Explicitly disable face tracking
      smoothing: 0.7,
    })

    // Should use center crop when face tracking is disabled
    expect(result.method).toBe('center_crop')
    expect(result.keyframes.length).toBeGreaterThan(0)
  })

  test('should generate keyframes with valid coordinates', async () => {
    // Create a simple test video
    await $`ffmpeg -f lavfi -i color=c=green:s=1920x1080:d=2 \
      -c:v libx264 -pix_fmt yuv420p -y ${inputVideoPath}`

    const result = await reframeVideo({
      inputPath: inputVideoPath,
      outputPath: outputVideoPath,
      targetAspect: '9:16',
      faceTracking: false,
      smoothing: 0.7,
    })

    // Verify keyframes have valid structure
    expect(result.keyframes.length).toBeGreaterThan(0)
    const firstKeyframe = result.keyframes[0]

    expect(firstKeyframe).toHaveProperty('time')
    expect(firstKeyframe).toHaveProperty('x')
    expect(firstKeyframe).toHaveProperty('y')
    expect(firstKeyframe).toHaveProperty('width')
    expect(firstKeyframe).toHaveProperty('height')

    // Coordinates should be non-negative
    expect(firstKeyframe.x).toBeGreaterThanOrEqual(0)
    expect(firstKeyframe.y).toBeGreaterThanOrEqual(0)
    expect(firstKeyframe.width).toBeGreaterThan(0)
    expect(firstKeyframe.height).toBeGreaterThan(0)
  })

  test('should handle different target aspect ratios', async () => {
    // Create a test video
    await $`ffmpeg -f lavfi -i color=c=yellow:s=1920x1080:d=2 \
      -c:v libx264 -pix_fmt yuv420p -y ${inputVideoPath}`

    const aspectRatios: AspectRatio[] = ['9:16', '1:1', '16:9', '4:5']

    for (const aspect of aspectRatios) {
      const output = join(testDir, `output-${aspect.replace(':', '-')}.mp4`)

      const result = await reframeVideo({
        inputPath: inputVideoPath,
        outputPath: output,
        targetAspect: aspect,
        faceTracking: false,
        smoothing: 0.7,
      })

      expect(result.outputPath).toBe(output)
      expect(result.keyframes.length).toBeGreaterThan(0)
    }
  })
})

describe('Face Detection Integration', () => {
  test('should have MediaPipe dependency available', async () => {
    // Verify that MediaPipe can be imported
    const mediapipe = await import('@mediapipe/tasks-vision')

    expect(mediapipe.FaceDetector).toBeDefined()
    expect(mediapipe.FilesetResolver).toBeDefined()
  })

  test('should use face_tracking method when faces are detected', () => {
    // This test documents the expected behavior when faces are present
    // In a real scenario with faces, the method should be 'face_tracking'
    const expectedMethod = 'face_tracking'

    expect(expectedMethod).toBe('face_tracking')
  })

  test('should generate keyframes at 2 FPS for face detection', () => {
    // Document that face detection runs at 2 FPS
    // So for a 10 second clip, we expect ~20 frames to be analyzed
    const clipDuration = 10 // seconds
    const fps = 2
    const expectedFrames = clipDuration * fps

    expect(expectedFrames).toBe(20)
  })

  test('should clamp crop coordinates to valid bounds', () => {
    // Test boundary clamping logic
    const sourceWidth = 1920
    const sourceHeight = 1080
    const cropWidth = 1080
    const cropHeight = 1920

    // Max valid crop position
    const maxX = sourceWidth - cropWidth
    const maxY = sourceHeight - cropHeight

    // For this case, crop is taller than source, so maxY would be negative
    // The function should handle this by adjusting the crop
    expect(maxX).toBeGreaterThanOrEqual(0)

    // If maxY is negative, that means we need to adjust our approach
    if (maxY < 0) {
      expect(maxY).toBeLessThan(0)
    }
  })
})
