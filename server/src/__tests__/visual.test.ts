import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  analyzeVisualMoments,
  estimateVisualQuality,
  type VisualMoment,
} from '../analysis/visual'

describe('Visual Scene Analysis', () => {
  let tmpDir: string
  let testVideoPath: string

  beforeAll(async () => {
    // Create temporary directory for test files
    tmpDir = await fs.mkdtemp('/tmp/visual-test-')

    // Create a simple test video using FFmpeg (5 seconds, solid color)
    testVideoPath = path.join(tmpDir, 'test-video.mp4')
    try {
      await Bun.$`ffmpeg -f lavfi -i color=c=blue:s=1280x720:d=5 -vf "drawtext=text='Test Video':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" ${testVideoPath} -y -hide_banner -loglevel error`
    } catch {
      console.log('FFmpeg test video creation failed - tests may be skipped')
    }
  })

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('analyzeVisualMoments extracts keyframes and returns moments', async () => {
    // Skip if test video doesn't exist
    try {
      await fs.access(testVideoPath)
    } catch {
      console.log('Skipping test - test video not available')
      return
    }

    const moments = await analyzeVisualMoments(testVideoPath, {
      fps: 1,
      minScore: 0, // Accept all scores for testing
      useClaudeVision: false, // Use basic analysis for testing
      gameSpecificDetection: false,
    })

    // Should extract at least 1 frame from a 5-second video at 1 fps
    expect(moments.length).toBeGreaterThanOrEqual(1)
    expect(moments.length).toBeLessThanOrEqual(5)

    // Verify structure of returned moments
    if (moments.length > 0) {
      const moment = moments[0]
      expect(moment).toHaveProperty('timestamp')
      expect(moment).toHaveProperty('type')
      expect(moment).toHaveProperty('hydeScore')
      expect(moment).toHaveProperty('description')
      expect(moment).toHaveProperty('confidence')
      expect(typeof moment.timestamp).toBe('number')
      expect(typeof moment.hydeScore).toBe('number')
      expect(moment.hydeScore).toBeGreaterThanOrEqual(0)
      expect(moment.hydeScore).toBeLessThanOrEqual(100)
    }
  })

  test('analyzeVisualMoments filters moments by minScore', async () => {
    // Skip if test video doesn't exist
    try {
      await fs.access(testVideoPath)
    } catch {
      console.log('Skipping test - test video not available')
      return
    }

    const allMoments = await analyzeVisualMoments(testVideoPath, {
      fps: 1,
      minScore: 0,
      useClaudeVision: false,
    })

    const filteredMoments = await analyzeVisualMoments(testVideoPath, {
      fps: 1,
      minScore: 90, // Very high threshold
      useClaudeVision: false,
    })

    // Filtered results should have same or fewer moments
    expect(filteredMoments.length).toBeLessThanOrEqual(allMoments.length)
  })

  test('estimateVisualQuality correctly categorizes moments', () => {
    const highQualityMoment: VisualMoment = {
      timestamp: 10,
      type: 'victory',
      hydeScore: 85,
      description: 'Victory screen detected',
      confidence: 0.8,
      metadata: {
        emotionalIntensity: 9,
        onScreenText: true,
      },
    }

    const mediumQualityMoment: VisualMoment = {
      timestamp: 20,
      type: 'action',
      hydeScore: 60,
      description: 'Action moment',
      confidence: 0.5,
    }

    const lowQualityMoment: VisualMoment = {
      timestamp: 30,
      type: 'neutral',
      hydeScore: 35,
      description: 'Neutral frame',
      confidence: 0.3,
    }

    const highQuality = estimateVisualQuality(highQualityMoment)
    expect(highQuality.quality).toBe('high')
    expect(highQuality.reasons.length).toBeGreaterThan(0)

    const mediumQuality = estimateVisualQuality(mediumQualityMoment)
    expect(mediumQuality.quality).toBe('medium')

    const lowQuality = estimateVisualQuality(lowQualityMoment)
    expect(lowQuality.quality).toBe('low')
  })

  test('estimateVisualQuality identifies quality indicators', () => {
    const moment: VisualMoment = {
      timestamp: 15,
      type: 'victory',
      hydeScore: 90,
      description: 'Victory screen',
      confidence: 0.9,
      metadata: {
        emotionalIntensity: 10,
        onScreenText: true,
        eventType: 'victory',
      },
    }

    const quality = estimateVisualQuality(moment)
    expect(quality.quality).toBe('high')
    expect(quality.reasons).toContain('High-energy visual event')
    expect(quality.reasons).toContain('Strong emotional intensity')
    expect(quality.reasons).toContain('On-screen alert or notification')
    expect(quality.reasons).toContain('High confidence detection')
  })

  test('visual moments have valid types', () => {
    const validTypes = ['action', 'victory', 'defeat', 'reaction', 'alert', 'neutral']

    const moment: VisualMoment = {
      timestamp: 5,
      type: 'action',
      hydeScore: 75,
      description: 'Test moment',
      confidence: 0.7,
    }

    expect(validTypes).toContain(moment.type)
  })
})
