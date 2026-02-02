/**
 * Signal Fusion Module
 * 
 * Combines signals from multiple sources to identify the best clip moments.
 * The key insight: moments where multiple signals converge are almost always good.
 */

import { ChatMoment } from './chat'
import { AudioMoment } from './audio'
import { TranscriptMoment } from './transcript'

export interface SignalMoment {
  timestamp: number
  duration: number // suggested clip duration
  score: number // combined score (0-100)
  confidence: number // how confident we are (0-1)
  signals: {
    chat?: { score: number; velocity: number }
    audio?: { score: number; type: string }
    clips?: { score: number; count: number }
    transcript?: { score: number; type: string; excerpt: string }
  }
  suggestedTitle?: string
}

export interface FusionConfig {
  // Signal weights (should sum to 1)
  weights: {
    chat: number
    audio: number
    clips: number // viewer-created clips
    transcript: number // LLM-analyzed transcript
  }
  // Timing
  preRoll: number // seconds before peak
  postRoll: number // seconds after peak
  minDuration: number
  maxDuration: number
  // Thresholds
  minScore: number // minimum combined score to consider
  convergenceBonus: number // bonus for multiple signals at same time
  convergenceWindow: number // seconds to consider "same time"
}

const DEFAULT_CONFIG: FusionConfig = {
  weights: {
    chat: 0.3,
    audio: 0.3,
    transcript: 0.3,
    clips: 0.1,
  },
  preRoll: 5,
  postRoll: 8,
  minDuration: 10,
  maxDuration: 60,
  minScore: 20, // Lowered to accommodate single-signal moments (e.g., transcript-only with 85 * 0.3 = 25.5)
  convergenceBonus: 20,
  convergenceWindow: 5,
}

export interface ViewerClip {
  timestamp: number // offset into VOD
  duration: number
  viewCount: number
  title: string
}

/**
 * Fuse multiple signal sources into unified moment detection
 */
export function fuseSignals(
  chatMoments: ChatMoment[],
  audioMoments: AudioMoment[],
  viewerClips: ViewerClip[] = [],
  transcriptMoments: TranscriptMoment[] = [],
  config: Partial<FusionConfig> = {}
): SignalMoment[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Collect all timestamps
  const allTimestamps = new Set<number>()

  chatMoments.forEach(m => allTimestamps.add(Math.round(m.timestamp)))
  audioMoments.forEach(m => allTimestamps.add(Math.round(m.timestamp)))
  viewerClips.forEach(c => allTimestamps.add(Math.round(c.timestamp)))
  transcriptMoments.forEach(m => allTimestamps.add(Math.round(m.timestamp)))

  const candidates: SignalMoment[] = []

  // For each timestamp, calculate combined score
  for (const timestamp of allTimestamps) {
    const signals: SignalMoment['signals'] = {}
    let totalScore = 0
    let signalCount = 0
    
    // Find nearby chat moment
    const chatMoment = chatMoments.find(
      m => Math.abs(m.timestamp - timestamp) <= cfg.convergenceWindow
    )
    if (chatMoment) {
      signals.chat = {
        score: chatMoment.hydeScore,
        velocity: chatMoment.velocity,
      }
      totalScore += chatMoment.hydeScore * cfg.weights.chat
      signalCount++
    }
    
    // Find nearby audio moment
    const audioMoment = audioMoments.find(
      m => Math.abs(m.timestamp - timestamp) <= cfg.convergenceWindow
    )
    if (audioMoment) {
      signals.audio = {
        score: audioMoment.hydeScore,
        type: audioMoment.type,
      }
      totalScore += audioMoment.hydeScore * cfg.weights.audio
      signalCount++
    }
    
    // Find nearby viewer clips
    const nearbyClips = viewerClips.filter(
      c => Math.abs(c.timestamp - timestamp) <= cfg.convergenceWindow * 2
    )
    if (nearbyClips.length > 0) {
      // Score based on number of clips and their views
      const clipScore = Math.min(
        nearbyClips.length * 20 +
        nearbyClips.reduce((sum, c) => sum + Math.log10(c.viewCount + 1) * 10, 0),
        100
      )
      signals.clips = {
        score: clipScore,
        count: nearbyClips.length,
      }
      totalScore += clipScore * cfg.weights.clips
      signalCount++
    }

    // Find nearby transcript moment
    const transcriptMoment = transcriptMoments.find(
      m => Math.abs(m.timestamp - timestamp) <= cfg.convergenceWindow
    )
    if (transcriptMoment) {
      signals.transcript = {
        score: transcriptMoment.hydeScore,
        type: transcriptMoment.type,
        excerpt: transcriptMoment.excerpt,
      }
      totalScore += transcriptMoment.hydeScore * cfg.weights.transcript
      signalCount++
    }

    // Apply convergence bonus
    if (signalCount >= 2) {
      totalScore += cfg.convergenceBonus * (signalCount - 1)
    }

    // Calculate confidence (max 4 signal types now)
    const confidence = signalCount / 4
    
    // Skip if below threshold
    if (totalScore < cfg.minScore) continue
    
    // Calculate suggested duration based on signal types
    let duration = cfg.preRoll + cfg.postRoll
    if (signals.audio?.type === 'sustained') {
      duration += 5 // longer for sustained audio moments
    }
    if (signals.chat && signals.chat.velocity > 5) {
      duration += 3 // longer for high chat velocity
    }
    if (signals.transcript) {
      // Use transcript moment's suggested duration if available
      const transcriptDuration = transcriptMoment?.duration || 0
      if (transcriptDuration > duration) {
        duration = transcriptDuration
      }
    }
    duration = Math.max(cfg.minDuration, Math.min(duration, cfg.maxDuration))

    // Generate suggested title
    const suggestedTitle = generateTitle(signals, nearbyClips)
    
    candidates.push({
      timestamp,
      duration,
      score: Math.round(Math.min(totalScore, 100)),
      confidence,
      signals,
      suggestedTitle,
    })
  }
  
  // Sort by score and deduplicate overlapping moments
  return deduplicateMoments(
    candidates.sort((a, b) => b.score - a.score),
    cfg
  )
}

/**
 * Remove overlapping moments, keeping higher scored ones
 */
function deduplicateMoments(
  moments: SignalMoment[],
  config: FusionConfig
): SignalMoment[] {
  const result: SignalMoment[] = []
  
  for (const moment of moments) {
    // Check if this moment overlaps with any already selected
    const overlaps = result.some(existing => {
      const existingStart = existing.timestamp - config.preRoll
      const existingEnd = existing.timestamp + existing.duration - config.preRoll
      const newStart = moment.timestamp - config.preRoll
      const newEnd = moment.timestamp + moment.duration - config.preRoll
      
      return (newStart < existingEnd && newEnd > existingStart)
    })
    
    if (!overlaps) {
      result.push(moment)
    }
  }
  
  // Sort by timestamp for output
  return result.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Generate a suggested title based on signals
 */
function generateTitle(
  signals: SignalMoment['signals'],
  viewerClips: ViewerClip[]
): string {
  // If transcript has a good excerpt, prioritize that
  if (signals.transcript?.excerpt && signals.transcript.excerpt.length > 10) {
    // Use first part of excerpt as title (up to 50 chars)
    const excerpt = signals.transcript.excerpt.trim()
    if (excerpt.length <= 50) {
      return excerpt
    }
    return excerpt.substring(0, 47) + '...'
  }

  // If viewers already clipped this, use their titles as inspiration
  if (viewerClips.length > 0) {
    // Find most viewed clip's title
    const bestClip = viewerClips.reduce((best, clip) =>
      clip.viewCount > best.viewCount ? clip : best
    )
    if (bestClip.title && bestClip.title.length > 3) {
      return bestClip.title
    }
  }

  // Generate based on signals
  const parts: string[] = []

  if (signals.transcript?.type === 'funny') {
    parts.push('Hilarious moment')
  } else if (signals.transcript?.type === 'intense') {
    parts.push('Intense moment')
  } else if (signals.transcript?.type === 'quotable') {
    parts.push('Quotable moment')
  }

  if (signals.audio?.type === 'silence_break') {
    parts.push('The moment everyone waited for')
  } else if (signals.audio?.score && signals.audio.score > 80) {
    parts.push('Insane reaction')
  }

  if (signals.chat?.velocity && signals.chat.velocity > 8) {
    parts.push('Chat went crazy')
  }

  if (signals.clips?.count && signals.clips.count > 3) {
    parts.push('The clip everyone made')
  }

  return parts.length > 0 ? parts[0] : 'Highlight moment'
}

/**
 * Estimate clip quality based on signal analysis
 */
export function estimateClipQuality(moment: SignalMoment): {
  quality: 'high' | 'medium' | 'low'
  reasons: string[]
} {
  const reasons: string[] = []
  
  // High quality indicators
  if (moment.confidence >= 0.66) {
    reasons.push('Multiple signal convergence')
  }
  if (moment.score >= 70) {
    reasons.push('High combined score')
  }
  if (moment.signals.clips?.count && moment.signals.clips.count >= 2) {
    reasons.push('Viewer-validated moment')
  }
  if (moment.signals.audio?.type === 'silence_break') {
    reasons.push('Comedic timing detected')
  }
  
  // Determine quality
  let quality: 'high' | 'medium' | 'low'
  if (moment.score >= 70 && moment.confidence >= 0.5) {
    quality = 'high'
  } else if (moment.score >= 50 || moment.confidence >= 0.66) {
    quality = 'medium'
  } else {
    quality = 'low'
  }
  
  return { quality, reasons }
}
