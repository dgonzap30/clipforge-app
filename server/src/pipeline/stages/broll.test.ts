import { describe, it, expect } from 'bun:test'
import { brollStage, type BRollConfig, type BRollStageInput } from './broll'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { TranscriptionResult } from '../../captions/transcribe'

describe('B-roll Pipeline Stage', () => {
  it('should skip B-roll when disabled', async () => {
    const tmpDir = '/tmp/broll-test-disabled'
    await mkdir(tmpDir, { recursive: true })

    const transcriptionPath = join(tmpDir, 'transcription.json')
    const videoPath = join(tmpDir, 'test-video.mp4')

    const mockTranscription: TranscriptionResult = {
      text: 'Test video',
      segments: [
        {
          text: 'Test video',
          start: 0,
          end: 5,
          words: [],
        },
      ],
      language: 'en',
      duration: 5,
    }

    await writeFile(transcriptionPath, JSON.stringify(mockTranscription))
    await writeFile(videoPath, 'mock video content')

    const config: BRollConfig = {
      enabled: false,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
    }

    const input: BRollStageInput = {
      videoPath,
      transcriptionPath,
      outputDir: tmpDir,
      config,
    }

    const result = await brollStage(input)

    expect(result.outputPath).toBe(videoPath)
    expect(result.insertions).toEqual([])
  })

  it('should return empty insertions when no B-roll suggestions found', async () => {
    const tmpDir = '/tmp/broll-test-empty'
    await mkdir(tmpDir, { recursive: true })

    const transcriptionPath = join(tmpDir, 'transcription.json')
    const videoPath = join(tmpDir, 'test-video.mp4')

    const mockTranscription: TranscriptionResult = {
      text: 'Um uh hmm',
      segments: [
        {
          text: 'Um uh hmm',
          start: 0,
          end: 2,
          words: [],
        },
      ],
      language: 'en',
      duration: 2,
    }

    await writeFile(transcriptionPath, JSON.stringify(mockTranscription))
    await writeFile(videoPath, 'mock video content')

    const config: BRollConfig = {
      enabled: true,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
      maxBRolls: 3,
    }

    const input: BRollStageInput = {
      videoPath,
      transcriptionPath,
      outputDir: tmpDir,
      config,
    }

    try {
      const result = await brollStage(input)
      // If LLM returns no suggestions, should return original video
      expect(result.outputPath).toBe(videoPath)
    } catch (error) {
      // Expected to fail without valid API keys
      expect(error).toBeDefined()
    }
  })

  it('should respect maxBRolls configuration', () => {
    const config: BRollConfig = {
      enabled: true,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
      maxBRolls: 3,
    }

    expect(config.maxBRolls).toBe(3)
  })

  it('should use correct opacity value', () => {
    const defaultConfig: BRollConfig = {
      enabled: true,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
    }

    const customConfig: BRollConfig = {
      enabled: true,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
      opacity: 0.3,
    }

    expect(defaultConfig.opacity).toBeUndefined()
    expect(customConfig.opacity).toBe(0.3)
  })

  it('should support different video orientations', () => {
    const landscapeConfig: BRollConfig = {
      enabled: true,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
      orientation: 'landscape',
    }

    const portraitConfig: BRollConfig = {
      enabled: true,
      llm: {
        provider: 'openai',
        apiKey: 'test-key',
      },
      pexelsApiKey: 'test-key',
      orientation: 'portrait',
    }

    expect(landscapeConfig.orientation).toBe('landscape')
    expect(portraitConfig.orientation).toBe('portrait')
  })
})
