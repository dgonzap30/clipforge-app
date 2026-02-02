/**
 * Tests for the analysis pipeline stage
 */

import { describe, test, expect, beforeEach, spyOn, afterEach } from 'bun:test'
import { analyze, analyzeWithDefaultWeights, type AnalyzeStageInput } from './analyze'
import type { ChatMoment } from '../../analysis/chat'
import type { ViewerClip } from '../../analysis/fusion'
import * as audio from '../../analysis/audio'
import * as fusion from '../../analysis/fusion'

let extractAudioSpy: any
let getAudioLevelsSpy: any
let analyzeAudioLevelsSpy: any
let fuseSignalsSpy: any

describe('analyze', () => {
  beforeEach(() => {
    // Mock audio module functions
    extractAudioSpy = spyOn(audio, 'extractAudio').mockResolvedValue(undefined)

    getAudioLevelsSpy = spyOn(audio, 'getAudioLevels').mockResolvedValue([
      { timestamp: 0, amplitude: 0.2, rms: 0.14 },
      { timestamp: 1, amplitude: 0.9, rms: 0.64 },
      { timestamp: 2, amplitude: 0.3, rms: 0.21 },
      { timestamp: 10, amplitude: 0.95, rms: 0.67 },
    ])

    analyzeAudioLevelsSpy = spyOn(audio, 'analyzeAudioLevels').mockReturnValue([
      {
        timestamp: 1,
        amplitude: 0.9,
        rmsLevel: 0.64,
        hydeScore: 85,
        type: 'peak' as const,
      },
      {
        timestamp: 10,
        amplitude: 0.95,
        rmsLevel: 0.67,
        hydeScore: 90,
        type: 'sustained' as const,
      },
    ])

    fuseSignalsSpy = spyOn(fusion, 'fuseSignals').mockReturnValue([
      {
        timestamp: 1,
        duration: 13,
        score: 72,
        confidence: 0.33,
        signals: {
          audio: { score: 85, type: 'peak' },
        },
      },
      {
        timestamp: 10,
        duration: 13,
        score: 76,
        confidence: 0.33,
        signals: {
          audio: { score: 90, type: 'sustained' },
        },
      },
    ])
  })

  afterEach(() => {
    extractAudioSpy?.mockRestore()
    getAudioLevelsSpy?.mockRestore()
    analyzeAudioLevelsSpy?.mockRestore()
    fuseSignalsSpy?.mockRestore()
  })

  test('should process video through full pipeline', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    const result = await analyze(input)

    expect(result).toBeDefined()
    expect(result.audioMoments).toHaveLength(2)
    expect(result.fusedMoments).toHaveLength(2)
    expect(result.audioPath).toBe('/path/to/video_audio.wav')
  })

  test('should call extractAudio with correct paths', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/test.mp4',
    }

    await analyze(input)

    expect(audio.extractAudio).toHaveBeenCalledTimes(1)
    expect(audio.extractAudio).toHaveBeenCalledWith(
      '/path/to/test.mp4',
      '/path/to/test_audio.wav'
    )
  })

  test('should use custom audio output path when provided', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    await analyze(input, {
      audioOutputPath: '/custom/audio.wav',
    })

    expect(audio.extractAudio).toHaveBeenCalledWith(
      '/path/to/video.mp4',
      '/custom/audio.wav'
    )
  })

  test('should pass custom weights to fuseSignals', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    const customWeights = {
      chat: 0.3,
      audio: 0.5,
      clips: 0.2,
    }

    await analyze(input, { weights: customWeights })

    expect(fusion.fuseSignals).toHaveBeenCalledTimes(1)
    const call = (fusion.fuseSignals as any).mock.calls[0]
    expect(call[3]).toEqual({
      weights: customWeights,
    })
  })

  test('should use default weights when not specified', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    await analyze(input)

    expect(fusion.fuseSignals).toHaveBeenCalledTimes(1)
    const call = (fusion.fuseSignals as any).mock.calls[0]
    expect(call[3]).toEqual({
      weights: {
        chat: 0,
        audio: 0.8,
        clips: 0.2,
      },
    })
  })

  test('should include chat moments when provided', async () => {
    const chatMoments: ChatMoment[] = [
      {
        timestamp: 1.5,
        velocity: 10,
        hydeScore: 80,
        messageCount: 50,
        topEmotes: ['Pog', 'KEKW'],
      },
    ]

    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
      chatMoments,
    }

    await analyze(input)

    // Get the last call to fuseSignals
    const calls = fuseSignalsSpy.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toEqual(chatMoments)
  })

  test('should include viewer clips when provided', async () => {
    const viewerClips: ViewerClip[] = [
      {
        timestamp: 10,
        duration: 30,
        viewCount: 1000,
        title: 'Epic moment',
      },
    ]

    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
      viewerClips,
    }

    await analyze(input)

    // Get the last call to fuseSignals
    const calls = fuseSignalsSpy.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[2]).toEqual(viewerClips)
  })
})

describe('analyzeWithDefaultWeights', () => {
  let extractAudioSpy2: any
  let getAudioLevelsSpy2: any
  let analyzeAudioLevelsSpy2: any
  let fuseSignalsSpy2: any

  beforeEach(() => {
    extractAudioSpy2 = spyOn(audio, 'extractAudio').mockResolvedValue(undefined)
    getAudioLevelsSpy2 = spyOn(audio, 'getAudioLevels').mockResolvedValue([])
    analyzeAudioLevelsSpy2 = spyOn(audio, 'analyzeAudioLevels').mockReturnValue([])
    fuseSignalsSpy2 = spyOn(fusion, 'fuseSignals').mockReturnValue([])
  })

  afterEach(() => {
    extractAudioSpy2?.mockRestore()
    getAudioLevelsSpy2?.mockRestore()
    analyzeAudioLevelsSpy2?.mockRestore()
    fuseSignalsSpy2?.mockRestore()
  })

  test('should use default weights (chat:0, audio:0.8, clips:0.2)', async () => {
    await analyzeWithDefaultWeights('/path/to/video.mp4')

    expect(fuseSignalsSpy2).toHaveBeenCalledTimes(1)
    const call = fuseSignalsSpy2.mock.calls[0]
    expect(call[3]).toEqual({
      weights: {
        chat: 0,
        audio: 0.8,
        clips: 0.2,
      },
    })
  })

  test('should handle optional chat and clip parameters', async () => {
    const chatMoments: ChatMoment[] = [
      {
        timestamp: 5,
        velocity: 8,
        hydeScore: 75,
        messageCount: 30,
        topEmotes: ['LUL'],
      },
    ]

    const viewerClips: ViewerClip[] = [
      {
        timestamp: 5,
        duration: 20,
        viewCount: 500,
        title: 'Funny clip',
      },
    ]

    await analyzeWithDefaultWeights('/path/to/video.mp4', chatMoments, viewerClips)

    const call = fuseSignalsSpy2.mock.calls[0]
    expect(call[0]).toEqual(chatMoments)
    expect(call[2]).toEqual(viewerClips)
  })
})
