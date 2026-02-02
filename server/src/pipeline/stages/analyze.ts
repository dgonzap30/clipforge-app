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
import { ChatMoment } from '../../analysis/chat'

export interface AnalyzeStageInput {
  videoPath: string
  chatMoments?: ChatMoment[]
  viewerClips?: ViewerClip[]
}

export interface AnalyzeStageOutput {
  audioMoments: AudioMoment[]
  fusedMoments: SignalMoment[]
  audioPath: string
}

export interface AnalyzeStageConfig {
  audioOutputPath?: string
  weights?: {
    chat: number
    audio: number
    clips: number
  }
}

const DEFAULT_WEIGHTS = {
  chat: 0,
  audio: 0.8,
  clips: 0.2,
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
  const { videoPath, chatMoments = [], viewerClips = [] } = input
  const weights = config.weights ?? DEFAULT_WEIGHTS

  // Generate audio output path if not provided
  const audioPath = config.audioOutputPath ??
    videoPath.replace(/\.[^.]+$/, '_audio.wav')

  // Step 1: Extract audio from video
  await extractAudio(videoPath, audioPath)

  // Step 2: Get audio amplitude levels
  const audioLevels = await getAudioLevels(audioPath)

  // Step 3: Analyze audio levels to find moments
  const audioMoments = analyzeAudioLevels(audioLevels)

  // Step 4: Fuse signals with specified weights
  const fusedMoments = fuseSignals(
    chatMoments,
    audioMoments,
    viewerClips,
    { weights }
  )

  return {
    audioMoments,
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
