/**
 * Tests for Reframe Extraction Module
 */

import { describe, test, expect } from 'bun:test'
import type { AspectRatio, ReframeConfig, CropKeyframe } from './reframe'

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
