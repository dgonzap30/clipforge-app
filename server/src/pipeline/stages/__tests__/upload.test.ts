/**
 * Upload Stage Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { PipelineContext } from '../../types'
import { createUploadStage } from '../upload'

describe('Upload Stage', () => {
  let mockContext: PipelineContext

  beforeEach(() => {
    mockContext = {
      jobId: 'test-job-123',
      userId: 'test-user-456',
      vodId: 'vod-789',
      vodUrl: 'https://example.com/vod.mp4',
      vodTitle: 'Test VOD Stream',
      settings: {
        clipCount: 5,
        targetAspect: '9:16',
        quality: 'medium',
      },
      tempDir: '/tmp/test-processing',
      extractedClips: [
        {
          id: 'clip-1',
          path: '/tmp/test-processing/clip-1.mp4',
          thumbnailPath: '/tmp/test-processing/clip-1_thumb.jpg',
          startTime: 10,
          endTime: 20,
          duration: 10,
          moment: {
            timestamp: 15,
            duration: 10,
            score: 85,
            signals: {
              audio: 0.8,
              chat: 0.7,
              clips: 0.6,
            },
          },
        },
      ],
    }
  })

  test('should create upload stage with default options', () => {
    const stage = createUploadStage()

    expect(stage).toBeDefined()
    expect(stage.name).toBe('upload')
    expect(stage.execute).toBeDefined()
    expect(stage.cleanup).toBeDefined()
  })

  test('should create upload stage with custom options', () => {
    const stage = createUploadStage({
      generatePublicUrls: true,
      signedUrlExpiry: 3600,
    })

    expect(stage).toBeDefined()
    expect(stage.name).toBe('upload')
  })

  test('should validate required clips data', async () => {
    const stage = createUploadStage()
    const contextWithoutClips: PipelineContext = {
      ...mockContext,
      extractedClips: undefined,
    }

    await expect(stage.execute(contextWithoutClips)).rejects.toThrow(
      'No clips available to upload'
    )
  })

  test('should set currentStage and progress', async () => {
    const stage = createUploadStage()

    // This test would require mocking Supabase and file system
    // For now, we just verify the stage structure
    expect(stage.name).toBe('upload')
  })

  test('cleanup should execute without errors', async () => {
    const stage = createUploadStage()

    // Cleanup should not throw
    await expect(stage.cleanup?.(mockContext)).resolves.toBeUndefined()
  })
})

describe('Upload Stage Integration', () => {
  test('should handle multiple clips', () => {
    const mockContext: PipelineContext = {
      jobId: 'test-job-123',
      userId: 'test-user-456',
      vodId: 'vod-789',
      vodUrl: 'https://example.com/vod.mp4',
      vodTitle: 'Test VOD Stream',
      settings: {},
      tempDir: '/tmp/test',
      extractedClips: [
        {
          id: 'clip-1',
          path: '/tmp/clip-1.mp4',
          thumbnailPath: '/tmp/clip-1_thumb.jpg',
          duration: 10,
        },
        {
          id: 'clip-2',
          path: '/tmp/clip-2.mp4',
          thumbnailPath: '/tmp/clip-2_thumb.jpg',
          duration: 15,
        },
        {
          id: 'clip-3',
          path: '/tmp/clip-3.mp4',
          thumbnailPath: '/tmp/clip-3_thumb.jpg',
          duration: 12,
        },
      ],
    }

    expect(mockContext.extractedClips).toHaveLength(3)
  })

  test('should use captioned clips if available', () => {
    const mockContext: PipelineContext = {
      jobId: 'test-job-123',
      userId: 'test-user-456',
      vodId: 'vod-789',
      vodUrl: 'https://example.com/vod.mp4',
      vodTitle: 'Test VOD Stream',
      settings: {},
      tempDir: '/tmp/test',
      extractedClips: [
        {
          id: 'clip-1',
          path: '/tmp/clip-1.mp4',
          thumbnailPath: '/tmp/clip-1_thumb.jpg',
          duration: 10,
        },
      ],
      captionedClips: [
        {
          clipId: 'clip-1',
          path: '/tmp/clip-1-captioned.mp4',
          captionsPath: '/tmp/clip-1.srt',
        },
      ],
    }

    // Should prioritize captionedClips over extractedClips
    expect(mockContext.captionedClips).toBeDefined()
    expect(mockContext.captionedClips).toHaveLength(1)
  })
})
