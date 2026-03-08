/**
 * Tests for the analysis pipeline stage
 */

import { describe, test, expect, beforeEach, spyOn, afterEach, type Mock } from 'bun:test'
import { analyze, analyzeWithDefaultWeights, type AnalyzeStageInput } from './analyze'
import type { ChatMoment } from '../../analysis/chat'
import type { ViewerClip } from '../../analysis/fusion'
import * as audio from '../../analysis/audio'
import * as fusion from '../../analysis/fusion'
import * as chat from '../../analysis/chat'

let extractAudioSpy: Mock<typeof audio.extractAudio>
let getAudioLevelsSpy: Mock<typeof audio.getAudioLevels>
let analyzeAudioLevelsSpy: Mock<typeof audio.analyzeAudioLevels>
let fuseSignalsSpy: Mock<typeof fusion.fuseSignals>
let fetchChatLogsSpy: Mock<typeof chat.fetchChatLogs>
let analyzeChatLogsSpy: Mock<typeof chat.analyzeChatLogs>

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

    // Mock chat module functions
    fetchChatLogsSpy = spyOn(chat, 'fetchChatLogs').mockResolvedValue([])
    analyzeChatLogsSpy = spyOn(chat, 'analyzeChatLogs').mockReturnValue([])
  })

  afterEach(() => {
    extractAudioSpy?.mockRestore()
    getAudioLevelsSpy?.mockRestore()
    analyzeAudioLevelsSpy?.mockRestore()
    fuseSignalsSpy?.mockRestore()
    fetchChatLogsSpy?.mockRestore()
    analyzeChatLogsSpy?.mockRestore()
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

      // @ts-ignore
    await analyze(input, { weights: customWeights })

    expect(fusion.fuseSignals).toHaveBeenCalledTimes(1)
    const call = fuseSignalsSpy.mock.calls[0]
      // @ts-ignore
    expect(call[3]).toEqual({
      // @ts-ignore
      weights: customWeights,
    })
  })

  test('should use default weights when not specified', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    await analyze(input)

    expect(fusion.fuseSignals).toHaveBeenCalledTimes(1)
      // @ts-ignore
    const call = fuseSignalsSpy.mock.calls[0]
    expect(call[3]).toEqual({
      // @ts-ignore
      weights: {
        chat: 0.4,
        audio: 0.4,
        clips: 0.2,
      },
    })
  })

  test('should include chat moments when provided', async () => {
    const chatMoments: ChatMoment[] = [
      {
        timestamp: 1.5,
        velocity: 10,
        emoteScore: 2.5,
        hydeScore: 80,
        peakMessages: ['PogChamp!', 'LETS GO!'],
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

  test('should fetch and analyze chat logs when vodId is provided', async () => {
    const mockChatMessages = [
      { timestamp: 10, username: 'user1', message: 'PogChamp!' },
      { timestamp: 11, username: 'user2', message: 'LETS GO!' },
    ]
    const mockChatMoments: ChatMoment[] = [
      {
        timestamp: 10,
        velocity: 5,
        emoteScore: 1.5,
        hydeScore: 75,
        peakMessages: ['PogChamp!', 'LETS GO!'],
      },
    ]

    fetchChatLogsSpy.mockResolvedValue(mockChatMessages)
    analyzeChatLogsSpy.mockReturnValue(mockChatMoments)

    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
      vodId: '123456789',
    }

    await analyze(input)

    expect(chat.fetchChatLogs).toHaveBeenCalledWith('123456789')
    expect(chat.analyzeChatLogs).toHaveBeenCalledWith(mockChatMessages)

    // Verify chat moments were passed to fuseSignals
    const calls = fuseSignalsSpy.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toEqual(mockChatMoments)
  })

  test('should not fetch chat logs when vodId is not provided', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    await analyze(input)

    expect(chat.fetchChatLogs).not.toHaveBeenCalled()
    expect(chat.analyzeChatLogs).not.toHaveBeenCalled()
  })

  test('should continue pipeline when chat fetching fails', async () => {
    fetchChatLogsSpy.mockRejectedValue(new Error('Network error'))

    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
      vodId: '123456789',
    }

    const result = await analyze(input)

    // Pipeline should continue despite chat fetch failure
    expect(result).toBeDefined()
    expect(result.audioMoments).toHaveLength(2)
    expect(result.fusedMoments).toHaveLength(2)
  })
})

describe('analyzeWithDefaultWeights', () => {
  let extractAudioSpy2: Mock<typeof audio.extractAudio>
  let getAudioLevelsSpy2: Mock<typeof audio.getAudioLevels>
  let analyzeAudioLevelsSpy2: Mock<typeof audio.analyzeAudioLevels>
  let fuseSignalsSpy2: Mock<typeof fusion.fuseSignals>

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

  test('should use default weights (chat:0.4, audio:0.4, clips:0.2)', async () => {
    await analyzeWithDefaultWeights('/path/to/video.mp4')

      // @ts-ignore
    expect(fuseSignalsSpy2).toHaveBeenCalledTimes(1)
    const call = fuseSignalsSpy2.mock.calls[0]
    expect(call[3]).toEqual({
      // @ts-ignore
      weights: {
        chat: 0.4,
        audio: 0.4,
        clips: 0.2,
      },
    })
  })

  test('should handle optional chat and clip parameters', async () => {
    const chatMoments: ChatMoment[] = [
      {
        timestamp: 5,
        velocity: 8,
        emoteScore: 1.8,
        hydeScore: 75,
        peakMessages: ['LUL', 'KEKW'],
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

describe('analyze with job settings', () => {
  let extractAudioSpy3: any
  let getAudioLevelsSpy3: any
  let analyzeAudioLevelsSpy3: any
  let fuseSignalsSpy3: any

  beforeEach(() => {
    extractAudioSpy3 = spyOn(audio, 'extractAudio').mockResolvedValue(undefined)
    getAudioLevelsSpy3 = spyOn(audio, 'getAudioLevels').mockResolvedValue([])
    analyzeAudioLevelsSpy3 = spyOn(audio, 'analyzeAudioLevels').mockReturnValue([])
    fuseSignalsSpy3 = spyOn(fusion, 'fuseSignals').mockReturnValue([])
  })

  afterEach(() => {
    extractAudioSpy3?.mockRestore()
    getAudioLevelsSpy3?.mockRestore()
    analyzeAudioLevelsSpy3?.mockRestore()
    fuseSignalsSpy3?.mockRestore()
  })

  test('should honor minDuration and maxDuration settings', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    await analyze(input, {
      minDuration: 20,
      maxDuration: 90,
    })

    expect(fuseSignalsSpy3).toHaveBeenCalledTimes(1)
    const call = fuseSignalsSpy3.mock.calls[0]
    expect(call[3]).toMatchObject({
      minDuration: 20,
      maxDuration: 90,
    })
  })

  test('should honor sensitivity setting via minScore', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    await analyze(input, {
      minScore: 50, // equivalent to 'low' sensitivity
    })

    expect(fuseSignalsSpy3).toHaveBeenCalledTimes(1)
    const call = fuseSignalsSpy3.mock.calls[0]
    expect(call[3]).toMatchObject({
      minScore: 50,
    })
  })

  test('should accept all fusion config options', async () => {
    const input: AnalyzeStageInput = {
      videoPath: '/path/to/video.mp4',
    }

    const fusionConfig = {
      weights: { chat: 0.3, audio: 0.5, clips: 0.2 },
      minScore: 40,
      minDuration: 15,
      maxDuration: 75,
      preRoll: 3,
      postRoll: 7,
      // @ts-ignore
      convergenceBonus: 25,
      convergenceWindow: 8,
    }

      // @ts-ignore
    await analyze(input, fusionConfig)

    expect(fuseSignalsSpy3).toHaveBeenCalledTimes(1)
    const call = fuseSignalsSpy3.mock.calls[0]
    expect(call[3]).toEqual(fusionConfig)
  })
})
