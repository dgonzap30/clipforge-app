/**
 * Tests for Caption Pipeline Stage
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { captionStage, captionStageWithAPI, captionStageWithLocal } from './caption'
import type { TranscriptionResult } from '../../captions/transcribe'

// Mock the transcribe module
const mockTranscription: TranscriptionResult = {
  text: 'Hello world, this is a test.',
  segments: [
    {
      text: 'Hello world,',
      start: 0,
      end: 1.5,
      words: [
        { word: 'Hello', start: 0, end: 0.5, confidence: 0.99 },
        { word: 'world,', start: 0.6, end: 1.5, confidence: 0.98 },
      ],
    },
    {
      text: 'this is a test.',
      start: 1.6,
      end: 3.0,
      words: [
        { word: 'this', start: 1.6, end: 1.8, confidence: 0.97 },
        { word: 'is', start: 1.9, end: 2.0, confidence: 0.99 },
        { word: 'a', start: 2.1, end: 2.2, confidence: 0.98 },
        { word: 'test.', start: 2.3, end: 3.0, confidence: 0.96 },
      ],
    },
  ],
  language: 'en',
  duration: 3.0,
}

// Mock external dependencies
mock.module('../../captions/transcribe', () => ({
  transcribeWithWhisperAPI: mock(async () => mockTranscription),
  transcribeWithLocalWhisper: mock(async () => mockTranscription),
  generateTikTokASS: mock((segments: any) => {
    return '[Script Info]\nTitle: Test\n[Events]\nDialogue: 0,0:00:00.00,0:00:01.50,Default,,0,0,0,,Test'
  }),
  burnCaptions: mock(async () => {}),
}))

mock.module('fs/promises', () => ({
  writeFile: mock(async () => {}),
}))

describe('captionStage', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mock.restore()
  })

  test('should complete full caption pipeline with API method', async () => {
    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        transcription: {
          method: 'api',
          apiKey: 'test-api-key',
          model: 'base',
        },
        styling: {
          fontSize: 48,
          position: 'center',
        },
        output: {
          saveTranscription: true,
          format: 'ass',
        },
      },
    })

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
    expect(result.assPath).toBe('/test/output/captions.ass')
    expect(result.outputVideoPath).toBe('/test/output/captioned_video.mp4')
    expect(result.transcriptionPath).toBe('/test/output/transcription.json')
  })

  test('should complete full caption pipeline with local method', async () => {
    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        transcription: {
          method: 'local',
          model: 'small',
        },
      },
    })

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
    expect(result.assPath).toBe('/test/output/captions.ass')
    expect(result.outputVideoPath).toBe('/test/output/captioned_video.mp4')
    expect(result.transcriptionPath).toBeUndefined()
  })

  test('should use default configuration when none provided', async () => {
    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
    })

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
    expect(result.assPath).toBe('/test/output/captions.ass')
    expect(result.outputVideoPath).toBe('/test/output/captioned_video.mp4')
  })

  test('should throw error when API method used without API key', async () => {
    const promise = captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        transcription: {
          method: 'api',
        },
      },
    })

    expect(promise).rejects.toThrow('API key is required when using Whisper API')
  })

  test('should save transcription when saveTranscription is true', async () => {
    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        output: {
          saveTranscription: true,
        },
      },
    })

    expect(result.transcriptionPath).toBe('/test/output/transcription.json')
  })

  test('should not save transcription when saveTranscription is false', async () => {
    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        output: {
          saveTranscription: false,
        },
      },
    })

    expect(result.transcriptionPath).toBeUndefined()
  })
})

describe('captionStageWithAPI', () => {
  test('should use API method with provided configuration', async () => {
    const result = await captionStageWithAPI(
      '/test/video.mp4',
      '/test/output',
      'test-api-key',
      {
        model: 'large',
        language: 'en',
        styling: {
          fontSize: 56,
          position: 'bottom',
        },
      }
    )

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
    expect(result.transcriptionPath).toBeDefined()
  })

  test('should work with minimal configuration', async () => {
    const result = await captionStageWithAPI(
      '/test/video.mp4',
      '/test/output',
      'test-api-key'
    )

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
  })
})

describe('captionStageWithLocal', () => {
  test('should use local method with provided configuration', async () => {
    const result = await captionStageWithLocal(
      '/test/video.mp4',
      '/test/output',
      {
        model: 'medium',
        language: 'es',
        styling: {
          fontSize: 40,
          position: 'top',
        },
      }
    )

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
    expect(result.transcriptionPath).toBeDefined()
  })

  test('should work with minimal configuration', async () => {
    const result = await captionStageWithLocal('/test/video.mp4', '/test/output')

    expect(result).toBeDefined()
    expect(result.transcription).toEqual(mockTranscription)
  })
})

describe('Integration expectations', () => {
  test('should follow the correct pipeline order', async () => {
    // This test documents the expected flow:
    // 1. Transcribe audio (API or local)
    // 2. Generate ASS file with TikTok styling
    // 3. Burn captions into video
    // 4. Optionally save transcription JSON

    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        transcription: { method: 'local' },
        output: { saveTranscription: true },
      },
    })

    // Verify all expected outputs
    expect(result.transcription).toBeDefined()
    expect(result.transcription.segments).toHaveLength(2)
    expect(result.assPath).toContain('captions.ass')
    expect(result.outputVideoPath).toContain('captioned_video.mp4')
    expect(result.transcriptionPath).toContain('transcription.json')
  })

  test('should pass styling options to ASS generator', async () => {
    const customStyling = {
      fontSize: 64,
      fontName: 'Impact',
      primaryColor: '&HFFFFFF',
      highlightColor: '&HFF00FF',
      outlineColor: '&H000000',
      position: 'top' as const,
    }

    const result = await captionStage({
      videoPath: '/test/video.mp4',
      outputDir: '/test/output',
      config: {
        styling: customStyling,
      },
    })

    expect(result).toBeDefined()
    // In a real integration test, we'd verify the ASS file contains these styles
  })
})
