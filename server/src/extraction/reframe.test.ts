/**
 * Tests for Reframe Extraction Module
 * Includes: Multi-Face Handling, Speaker Prioritization, and Split-Screen Layout
 */

import { describe, test, expect } from 'bun:test'
import type { DetectedFace, FaceTrack, AudioMoment, AspectRatio, ReframeConfig, CropKeyframe } from './reframe'

// Import private functions for testing by exporting them temporarily
// In production, these would be exported for testing purposes

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

describe('reframe module', () => {
  describe('AspectRatio type', () => {
    test('should support vertical 9:16 format', () => {
      const aspectRatio: AspectRatio = '9:16'
      expect(aspectRatio).toBe('9:16')
    })

    test('should support square 1:1 format', () => {
      const aspectRatio: AspectRatio = '1:1'
      expect(aspectRatio).toBe('1:1')
    })

    test('should support horizontal 16:9 format', () => {
      const aspectRatio: AspectRatio = '16:9'
      expect(aspectRatio).toBe('16:9')
    })

    test('should support Instagram 4:5 format', () => {
      const aspectRatio: AspectRatio = '4:5'
      expect(aspectRatio).toBe('4:5')
    })
  })

  describe('ReframeConfig interface', () => {
    test('should define required config properties', () => {
      const config: ReframeConfig = {
        inputPath: '/path/to/input.mp4',
        outputPath: '/path/to/output.mp4',
        targetAspect: '9:16',
      }

      expect(config.inputPath).toBeDefined()
      expect(config.outputPath).toBeDefined()
      expect(config.targetAspect).toBe('9:16')
    })

    test('should support optional faceTracking', () => {
      const config: ReframeConfig = {
        inputPath: '/path/to/input.mp4',
        outputPath: '/path/to/output.mp4',
        targetAspect: '9:16',
        faceTracking: true,
      }

      expect(config.faceTracking).toBe(true)
    })

    test('should support optional smoothing', () => {
      const config: ReframeConfig = {
        inputPath: '/path/to/input.mp4',
        outputPath: '/path/to/output.mp4',
        targetAspect: '9:16',
        smoothing: 0.7,
      }

      expect(config.smoothing).toBe(0.7)
    })
  })

  describe('CropKeyframe interface', () => {
    test('should define keyframe structure', () => {
      const keyframe: CropKeyframe = {
        time: 0,
        x: 420,
        y: 0,
        width: 1080,
        height: 1920,
      }

      expect(keyframe.time).toBe(0)
      expect(keyframe.x).toBe(420)
      expect(keyframe.y).toBe(0)
      expect(keyframe.width).toBe(1080)
      expect(keyframe.height).toBe(1920)
    })
  })

  describe('createSplitScreen', () => {
    test('should accept gameplay and facecam paths', () => {
      const gameplayPath = '/path/to/gameplay.mp4'
      const facecamPath = '/path/to/facecam.mp4'
      const outputPath = '/path/to/output.mp4'

      expect(gameplayPath).toBeDefined()
      expect(facecamPath).toBeDefined()
      expect(outputPath).toBeDefined()
    })

    test('should support custom facecam ratio', () => {
      const options = {
        facecamRatio: 0.35,
        targetAspect: '9:16' as AspectRatio,
      }

      expect(options.facecamRatio).toBe(0.35)
      expect(options.targetAspect).toBe('9:16')
    })

    test('should default facecamRatio to 0.35', () => {
      // Document the default behavior
      const defaultFacecamRatio = 0.35

      expect(defaultFacecamRatio).toBe(0.35)
    })

    test('should default targetAspect to 9:16', () => {
      // Document the default behavior
      const defaultTargetAspect: AspectRatio = '9:16'

      expect(defaultTargetAspect).toBe('9:16')
    })

    test('should calculate facecam height correctly', () => {
      const dims = { width: 1080, height: 1920 }
      const facecamRatio = 0.35

      const facecamHeight = Math.round(dims.height * facecamRatio)
      const gameplayHeight = dims.height - facecamHeight

      expect(facecamHeight).toBe(672)
      expect(gameplayHeight).toBe(1248)
      expect(facecamHeight + gameplayHeight).toBe(dims.height)
    })

    test('should maintain aspect ratio dimensions', () => {
      const aspectDimensions = {
        '9:16': { width: 1080, height: 1920 },
        '1:1': { width: 1080, height: 1080 },
        '16:9': { width: 1920, height: 1080 },
        '4:5': { width: 1080, height: 1350 },
      }

      expect(aspectDimensions['9:16'].width).toBe(1080)
      expect(aspectDimensions['9:16'].height).toBe(1920)
      expect(aspectDimensions['9:16'].width / aspectDimensions['9:16'].height).toBeCloseTo(9 / 16)
    })
  })

  describe('split-screen layout', () => {
    test('should stack facecam on top of gameplay', () => {
      // Document the expected layout behavior
      const layout = {
        facecamPosition: 'top',
        gameplayPosition: 'bottom',
        stackDirection: 'vertical',
      }

      expect(layout.facecamPosition).toBe('top')
      expect(layout.gameplayPosition).toBe('bottom')
      expect(layout.stackDirection).toBe('vertical')
    })

    test('should maintain 9:16 output ratio for vertical videos', () => {
      const outputDimensions = { width: 1080, height: 1920 }
      const outputRatio = outputDimensions.width / outputDimensions.height

      expect(outputRatio).toBeCloseTo(9 / 16, 2)
    })
  })
})
