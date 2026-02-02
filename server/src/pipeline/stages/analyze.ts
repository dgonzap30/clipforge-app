/**
 * Analysis Pipeline Stage
 *
 * Orchestrates audio analysis and signal fusion to identify highlight moments.
 * This stage:
 * 1. Extracts audio from video
 * 2. Analyzes audio levels for peaks/moments
 * 3. Fuses audio signals with other data sources (chat, clips)
 */

import { extractAudio, getAudioLevels, analyzeAudioLevels, AudioMoment } from '../../analysis/audio'
import { fuseSignals, SignalMoment, ViewerClip } from '../../analysis/fusion'
import { ChatMoment, fetchChatLogs, analyzeChatLogs } from '../../analysis/chat'
import { analyzeVisualMoments, VisualMoment } from '../../analysis/visual'

export interface AnalyzeStageInput {
  videoPath: string
  vodId?: string
  chatMoments?: ChatMoment[]
  viewerClips?: ViewerClip[]
}

export interface AnalyzeStageOutput {
  audioMoments: AudioMoment[]
  visualMoments: VisualMoment[]
  fusedMoments: SignalMoment[]
  audioPath: string
}

export interface AnalyzeStageConfig {
  audioOutputPath?: string
  weights?: {
    chat: number
    audio: number
    clips: number
    visual: number
  }
  enableVisualAnalysis?: boolean
  visualAnalysisFps?: number
}

const DEFAULT_WEIGHTS = {
  chat: 0.3,
  audio: 0.3,
  clips: 0.2,
  visual: 0.2,
}

/**
 * Run the analysis pipeline stage
 *
 * @param input - Video path and optional chat/clip data
 * @param config - Configuration for audio extraction and fusion weights
 * @returns Audio moments and fused signal moments
 */
export async function analyze(
  input: AnalyzeStageInput,
  config: AnalyzeStageConfig = {}
): Promise<AnalyzeStageOutput> {
  const { videoPath, vodId, chatMoments: providedChatMoments, viewerClips = [] } = input
  const weights = config.weights ?? DEFAULT_WEIGHTS

  // Generate audio output path if not provided
  const audioPath = config.audioOutputPath ??
    videoPath.replace(/\.[^.]+$/, '_audio.wav')

  // Step 1: Fetch and analyze chat logs if vodId is provided
  let chatMoments: ChatMoment[] = []
  if (vodId) {
    try {
      const chatLogs = await fetchChatLogs(vodId)
      chatMoments = analyzeChatLogs(chatLogs)
      console.log(`[analyze] Found ${chatMoments.length} chat moments from ${chatLogs.length} messages`)
    } catch (error) {
      console.warn(`[analyze] Chat analysis failed, continuing without chat data:`, error)
    }
  } else if (providedChatMoments) {
    chatMoments = providedChatMoments
  }

  // Step 2: Extract audio from video
  await extractAudio(videoPath, audioPath)

  // Step 3: Get audio amplitude levels
  const audioLevels = await getAudioLevels(audioPath)

  // Step 4: Analyze audio levels to find moments
  const audioMoments = analyzeAudioLevels(audioLevels)

  // Step 5: Analyze visual moments (if enabled)
  let visualMoments: VisualMoment[] = []
  if (config.enableVisualAnalysis !== false) {
    try {
      console.log('[Analyze] Running visual scene analysis')
      visualMoments = await analyzeVisualMoments(videoPath, {
        fps: config.visualAnalysisFps ?? 1,
        minScore: 30,
      })
    } catch (error) {
      console.error('[Analyze] Visual analysis failed, continuing without visual signals:', error)
    }
  }

  // Step 6: Fuse signals with specified weights
  const fusedMoments = fuseSignals(
    chatMoments,
    audioMoments,
    viewerClips,
    visualMoments,
    { weights }
  )

  return {
    audioMoments,
    visualMoments,
    fusedMoments,
    audioPath,
  }
}

/**
 * Analyze with default weights (chat:0, audio:0.8, clips:0.2)
 */
export async function analyzeWithDefaultWeights(
  videoPath: string,
  chatMoments?: ChatMoment[],
  viewerClips?: ViewerClip[]
): Promise<AnalyzeStageOutput> {
  return analyze(
    { videoPath, chatMoments, viewerClips },
    { weights: DEFAULT_WEIGHTS }
  )
}
