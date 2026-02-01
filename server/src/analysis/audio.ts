/**
 * Audio Analysis Module
 * 
 * Analyzes audio track to detect moments of:
 * - Volume spikes (screaming, cheering)
 * - Laughter
 * - Sudden silence followed by explosion (comedic timing)
 */

import { $ } from 'bun'

export interface AudioMoment {
  timestamp: number // seconds
  amplitude: number // peak amplitude (0-1)
  rmsLevel: number // root mean square level
  hydeScore: number // 0-100
  type: 'peak' | 'silence_break' | 'sustained'
}

export interface AudioAnalysisConfig {
  windowSize: number // seconds
  peakThreshold: number // amplitude threshold for peaks (0-1)
  silenceThreshold: number // amplitude below this is silence
  minGap: number // minimum seconds between detected moments
}

const DEFAULT_CONFIG: AudioAnalysisConfig = {
  windowSize: 0.5,
  peakThreshold: 0.7,
  silenceThreshold: 0.1,
  minGap: 3,
}

/**
 * Extract audio from video file using FFmpeg
 */
export async function extractAudio(
  inputPath: string, 
  outputPath: string
): Promise<void> {
  // Extract mono audio at 16kHz for analysis
  await $`ffmpeg -i ${inputPath} -vn -acodec pcm_s16le -ar 16000 -ac 1 -y ${outputPath}`
}

/**
 * Get audio amplitude data using FFmpeg
 * Returns array of [timestamp, amplitude] pairs
 */
export async function getAudioLevels(
  audioPath: string,
  config: Partial<AudioAnalysisConfig> = {}
): Promise<Array<{ timestamp: number; amplitude: number; rms: number }>> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  // Use FFmpeg to get volume levels
  // The astats filter outputs volume statistics
  const result = await $`ffmpeg -i ${audioPath} -af "astats=metadata=1:reset=${cfg.windowSize},ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-" -f null - 2>&1`.text()
  
  const levels: Array<{ timestamp: number; amplitude: number; rms: number }> = []
  
  // Parse FFmpeg output
  // Format: frame:XXX pts:XXX pts_time:XXX.XXX
  // lavfi.astats.Overall.Peak_level=-XX.XX
  
  const lines = result.split('\n')
  let currentTime = 0
  
  for (const line of lines) {
    const timeMatch = line.match(/pts_time:(\d+\.?\d*)/)
    if (timeMatch) {
      currentTime = parseFloat(timeMatch[1])
    }
    
    const peakMatch = line.match(/Peak_level=(-?\d+\.?\d*)/)
    if (peakMatch) {
      // Convert dB to linear amplitude (0-1)
      const db = parseFloat(peakMatch[1])
      const amplitude = db > -100 ? Math.pow(10, db / 20) : 0
      
      levels.push({
        timestamp: currentTime,
        amplitude: Math.min(amplitude, 1),
        rms: amplitude * 0.707, // approximate RMS
      })
    }
  }
  
  return levels
}

/**
 * Analyze audio levels to find hype moments
 */
export function analyzeAudioLevels(
  levels: Array<{ timestamp: number; amplitude: number; rms: number }>,
  config: Partial<AudioAnalysisConfig> = {}
): AudioMoment[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const moments: AudioMoment[] = []
  
  if (levels.length === 0) return []
  
  // Calculate baseline (median amplitude)
  const sorted = [...levels].sort((a, b) => a.amplitude - b.amplitude)
  const baseline = sorted[Math.floor(sorted.length / 2)].amplitude
  
  // Adaptive threshold based on baseline
  const adaptiveThreshold = Math.max(baseline * 3, cfg.peakThreshold)
  
  let lastMomentTime = -cfg.minGap
  let inSilence = false
  let silenceStart = 0
  
  for (let i = 0; i < levels.length; i++) {
    const { timestamp, amplitude, rms } = levels[i]
    
    // Track silence
    if (amplitude < cfg.silenceThreshold) {
      if (!inSilence) {
        silenceStart = timestamp
        inSilence = true
      }
    } else {
      // Check for silence break (silence followed by loud)
      if (inSilence && timestamp - silenceStart > 1 && amplitude > adaptiveThreshold) {
        if (timestamp - lastMomentTime >= cfg.minGap) {
          const hydeScore = Math.round(
            Math.min((amplitude / adaptiveThreshold) * 60 + 40, 100)
          )
          
          moments.push({
            timestamp,
            amplitude,
            rmsLevel: rms,
            hydeScore,
            type: 'silence_break',
          })
          
          lastMomentTime = timestamp
        }
      }
      inSilence = false
    }
    
    // Detect peaks
    if (amplitude > adaptiveThreshold && timestamp - lastMomentTime >= cfg.minGap) {
      // Check if sustained (multiple consecutive high samples)
      let sustainedCount = 0
      for (let j = i; j < Math.min(i + 10, levels.length); j++) {
        if (levels[j].amplitude > adaptiveThreshold * 0.7) {
          sustainedCount++
        }
      }
      
      const type = sustainedCount >= 5 ? 'sustained' : 'peak'
      const hydeScore = Math.round(
        Math.min((amplitude / adaptiveThreshold) * 50 + (sustainedCount * 5), 100)
      )
      
      moments.push({
        timestamp,
        amplitude,
        rmsLevel: rms,
        hydeScore,
        type,
      })
      
      lastMomentTime = timestamp
    }
  }
  
  return moments
}

/**
 * Simple peak detection without FFmpeg (for testing)
 * Works with raw PCM data
 */
export function detectPeaksFromPCM(
  samples: Int16Array,
  sampleRate: number,
  config: Partial<AudioAnalysisConfig> = {}
): AudioMoment[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const windowSamples = Math.floor(cfg.windowSize * sampleRate)
  const moments: AudioMoment[] = []
  
  let lastMomentTime = -cfg.minGap
  
  for (let i = 0; i < samples.length - windowSamples; i += windowSamples) {
    let maxAmplitude = 0
    let sumSquares = 0
    
    for (let j = i; j < i + windowSamples; j++) {
      const normalized = Math.abs(samples[j]) / 32768
      maxAmplitude = Math.max(maxAmplitude, normalized)
      sumSquares += normalized * normalized
    }
    
    const rms = Math.sqrt(sumSquares / windowSamples)
    const timestamp = i / sampleRate
    
    if (maxAmplitude > cfg.peakThreshold && timestamp - lastMomentTime >= cfg.minGap) {
      const hydeScore = Math.round(Math.min(maxAmplitude * 100, 100))
      
      moments.push({
        timestamp,
        amplitude: maxAmplitude,
        rmsLevel: rms,
        hydeScore,
        type: 'peak',
      })
      
      lastMomentTime = timestamp
    }
  }
  
  return moments
}
