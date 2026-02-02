/**
 * Effects Stage Tests
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { EffectsStage } from './effects'
import { PipelineContext } from '../types'

// Mock the fs module before importing EffectsStage
const mockExistsSync = mock((_path: string) => {
  // Return true for all paths to simulate files existing
  return true
})

mock.module('fs', () => ({
  existsSync: mockExistsSync,
}))

// Mock clipper module
mock.module('../../extraction/clipper', () => ({
  concatenateClipsWithTransitions: mock(async (config) => {
    // Simulate successful compilation by creating the file
    const fs = await import('fs/promises')
    const path = await import('path')

    // Create directory if needed
    const dir = path.dirname(config.outputPath)
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Write mock file
    await fs.writeFile(config.outputPath, 'mock video content')
  }),
}))

describe('EffectsStage', () => {
  let effectsStage: EffectsStage

  beforeEach(() => {
    effectsStage = new EffectsStage()
  })

  test('should have correct name', () => {
    expect(effectsStage.name).toBe('effects')
  })

  test('should throw error if outputDir is missing', async () => {
    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
      ],
    }

    await expect(effectsStage.execute(context)).rejects.toThrow(
      'Effects stage requires outputDir in context'
    )
  })

  test('should throw error if no clips are available', async () => {
    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
    }

    await expect(effectsStage.execute(context)).rejects.toThrow(
      'Effects stage requires captionedClips or reframedClips in context'
    )
  })

  test('should return single clip path if only one clip', async () => {
    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
      ],
    }

    const result = await effectsStage.execute(context)

    expect(result.compiledClipPath).toBe('/tmp/clip-1.mp4')
  })

  test('should compile multiple clips with default transitions', async () => {
    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
        { path: '/tmp/clip-2.mp4', originalPath: '/tmp/orig-2.mp4' },
        { path: '/tmp/clip-3.mp4', originalPath: '/tmp/orig-3.mp4' },
      ],
    }

    const result = await effectsStage.execute(context)

    expect(result.compiledClipPath).toBeDefined()
    expect(result.compiledClipPath).toMatch(/compilation-.*\.mp4/)
    expect(result.tempFiles).toContain(result.compiledClipPath)
  })

  test('should use custom default transition type', async () => {
    const effectsStageFlash = new EffectsStage({
      defaultTransition: 'flash',
      transitionDuration: 0.5,
    })

    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
        { path: '/tmp/clip-2.mp4', originalPath: '/tmp/orig-2.mp4' },
      ],
    }

    const result = await effectsStageFlash.execute(context)

    expect(result.compiledClipPath).toBeDefined()
  })

  test('should use custom output filename', async () => {
    const effectsStageCustom = new EffectsStage({
      outputFileName: 'my-compilation.mp4',
    })

    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
        { path: '/tmp/clip-2.mp4', originalPath: '/tmp/orig-2.mp4' },
      ],
    }

    const result = await effectsStageCustom.execute(context)

    expect(result.compiledClipPath).toBe('/tmp/output/my-compilation.mp4')
  })

  test('should use custom transitions array', async () => {
    const effectsStageCustomTransitions = new EffectsStage({
      transitions: [
        { type: 'flash', duration: 0.2 },
        { type: 'zoom-in', duration: 0.4 },
      ],
    })

    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
        { path: '/tmp/clip-2.mp4', originalPath: '/tmp/orig-2.mp4' },
        { path: '/tmp/clip-3.mp4', originalPath: '/tmp/orig-3.mp4' },
      ],
    }

    const result = await effectsStageCustomTransitions.execute(context)

    expect(result.compiledClipPath).toBeDefined()
  })

  test('should prefer captionedClips over reframedClips', async () => {
    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      reframedClips: [
        { path: '/tmp/reframed-1.mp4', originalPath: '/tmp/orig-1.mp4' },
        { path: '/tmp/reframed-2.mp4', originalPath: '/tmp/orig-2.mp4' },
      ],
      captionedClips: [
        { path: '/tmp/captioned-1.mp4', originalPath: '/tmp/reframed-1.mp4' },
        { path: '/tmp/captioned-2.mp4', originalPath: '/tmp/reframed-2.mp4' },
      ],
    }

    const result = await effectsStage.execute(context)

    expect(result.compiledClipPath).toBeDefined()
  })

  test('should use reframedClips if captionedClips not available', async () => {
    const context: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      reframedClips: [
        { path: '/tmp/reframed-1.mp4', originalPath: '/tmp/orig-1.mp4' },
        { path: '/tmp/reframed-2.mp4', originalPath: '/tmp/orig-2.mp4' },
      ],
    }

    const result = await effectsStage.execute(context)

    expect(result.compiledClipPath).toBeDefined()
  })

  test('should validate context correctly', async () => {
    const validContext: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
      captionedClips: [
        { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
      ],
    }

    const invalidContext: PipelineContext = {
      vodUrl: 'https://example.com/vod.mp4',
      workDir: '/tmp/work',
      outputDir: '/tmp/output',
      tempFiles: [],
    }

    expect(await effectsStage.validate(validContext)).toBe(true)
    expect(await effectsStage.validate(invalidContext)).toBe(false)
  })

  test('should handle all transition types', async () => {
    const transitionTypes = ['cut', 'flash', 'zoom-in', 'zoom-out'] as const

    for (const transitionType of transitionTypes) {
      const stage = new EffectsStage({
        defaultTransition: transitionType,
      })

      const context: PipelineContext = {
        vodUrl: 'https://example.com/vod.mp4',
        workDir: '/tmp/work',
        outputDir: '/tmp/output',
        tempFiles: [],
        captionedClips: [
          { path: '/tmp/clip-1.mp4', originalPath: '/tmp/orig-1.mp4' },
          { path: '/tmp/clip-2.mp4', originalPath: '/tmp/orig-2.mp4' },
        ],
      }

      const result = await stage.execute(context)
      expect(result.compiledClipPath).toBeDefined()
    }
  })
})
