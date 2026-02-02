/**
 * Hook Detection Module
 *
 * Analyzes clip openings to detect strong hooks and optimize clip boundaries.
 * Ensures clips start with engaging content and end on complete thoughts.
 */

import type { TranscriptionSegment, TranscriptionWord } from '../captions/transcribe'

export interface HookAnalysis {
  hookScore: number // 0-100, quality of the opening
  hookType: 'question' | 'reaction' | 'statement' | 'action' | 'weak' | 'none'
  firstWords: string[] // First 3-5 words
  hasFillerStart: boolean // Starts with um, uh, like, etc.
  hasSilentStart: boolean // First 2s is mostly silence
  startsMiddleSentence: boolean // Starts mid-sentence
}

export interface BoundaryOptimization {
  adjustedStart: number // New start timestamp (seconds)
  adjustedEnd: number // New end timestamp (seconds)
  adjustmentReason: string
  originalStart: number
  originalEnd: number
}

// Common filler words that weaken hooks
const FILLER_WORDS = new Set([
  'um', 'uh', 'umm', 'uhh', 'er', 'ah',
  'like', 'you know', 'i mean', 'sort of', 'kind of',
  'basically', 'actually', 'literally', 'well',
  'so', 'and', 'but', 'or'
])

// Strong hook indicators
const QUESTION_STARTERS = new Set([
  'what', 'how', 'why', 'when', 'where', 'who', 'which',
  'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'did'
])

const REACTION_STARTERS = new Set([
  'oh my god', 'oh my', 'omg', 'no way', 'wait', 'holy', 'whoa',
  'wow', 'what the', 'wtf', 'bruh', 'yo', 'damn'
])

const ACTION_STARTERS = new Set([
  'watch', 'look', 'check', 'see', 'get', 'let me', 'lets',
  'im gonna', "i'm gonna", 'were gonna', "we're gonna"
])

/**
 * Analyze the hook quality of a clip's opening
 */
export function analyzeHook(
  transcript: TranscriptionSegment[],
  clipStartTime: number,
  clipDuration: number
): HookAnalysis {
  // Extract first 3 seconds of transcript
  const hookWindow = 3 // seconds
  const hookEndTime = clipStartTime + hookWindow

  // Find all words in the hook window
  const hookWords: TranscriptionWord[] = []
  const allWords: TranscriptionWord[] = []

  for (const segment of transcript) {
    for (const word of segment.words) {
      // Adjust word timing relative to clip start
      const relativeStart = word.start

      if (relativeStart >= clipStartTime && relativeStart < clipStartTime + clipDuration) {
        allWords.push(word)
        if (relativeStart < hookEndTime) {
          hookWords.push(word)
        }
      }
    }
  }

  if (hookWords.length === 0) {
    return {
      hookScore: 0,
      hookType: 'none',
      firstWords: [],
      hasFillerStart: false,
      hasSilentStart: true,
      startsMiddleSentence: false
    }
  }

  // Extract first words
  const firstWords = hookWords.slice(0, 5).map(w => w.word.toLowerCase().trim())
  const firstWord = firstWords[0] || ''
  const firstPhrase = firstWords.slice(0, 3).join(' ')
  const firstTwoWords = firstWords.slice(0, 2).join(' ')

  // Check for silence at start
  const hasSilentStart = hookWords[0].start - clipStartTime > 0.5

  // Check if starts with filler
  const hasFillerStart = FILLER_WORDS.has(firstWord)

  // Check if starts mid-sentence
  // Heuristic: original word starts with lowercase (not capitalized) and isn't a question word
  const originalFirstWord = hookWords[0].word
  const startsMiddleSentence =
    originalFirstWord.length > 0 &&
    originalFirstWord[0] === originalFirstWord[0].toLowerCase() &&
    !QUESTION_STARTERS.has(firstWord) &&
    !FILLER_WORDS.has(firstWord)

  // Detect hook type
  let hookType: HookAnalysis['hookType'] = 'weak'
  let baseScore = 50

  // Question hook
  if (QUESTION_STARTERS.has(firstWord)) {
    hookType = 'question'
    baseScore = 85
  }
  // Reaction hook - check both single word and phrases
  else if (REACTION_STARTERS.has(firstWord) || REACTION_STARTERS.has(firstTwoWords) || REACTION_STARTERS.has(firstPhrase)) {
    hookType = 'reaction'
    baseScore = 90
  }
  // Action hook - check both single word and phrases
  else if (ACTION_STARTERS.has(firstWord) || ACTION_STARTERS.has(firstTwoWords) || ACTION_STARTERS.has(firstPhrase)) {
    hookType = 'action'
    baseScore = 80
  }
  // Statement hook (declarative sentence, capitalized start)
  else if (originalFirstWord.length > 0 && originalFirstWord[0] === originalFirstWord[0].toUpperCase() && !hasFillerStart) {
    hookType = 'statement'
    baseScore = 70
  }

  // Apply penalties
  let hookScore = baseScore

  if (startsMiddleSentence) {
    hookScore *= 0.7 // -30%
  }

  if (hasSilentStart) {
    hookScore *= 0.6 // -40%
  }

  if (hasFillerStart) {
    hookScore *= 0.8 // -20%
  }

  // Bonus for confident delivery (high word density in first 2s)
  const wordDensity = hookWords.filter(w => w.start < clipStartTime + 2).length / 2
  if (wordDensity > 3) {
    hookScore *= 1.1 // +10%
  }

  hookScore = Math.round(Math.max(0, Math.min(100, hookScore)))

  return {
    hookScore,
    hookType,
    firstWords,
    hasFillerStart,
    hasSilentStart,
    startsMiddleSentence
  }
}

/**
 * Optimize clip boundaries to align with sentence boundaries and improve hooks
 */
export function optimizeClipBoundaries(
  transcript: TranscriptionSegment[],
  clipStartTime: number,
  clipEndTime: number,
  maxAdjustment: number = 2 // max seconds to adjust
): BoundaryOptimization {
  const clipDuration = clipEndTime - clipStartTime

  // Find all words in the clip
  const clipWords: TranscriptionWord[] = []

  for (const segment of transcript) {
    for (const word of segment.words) {
      if (word.start >= clipStartTime - maxAdjustment &&
          word.start <= clipEndTime + maxAdjustment) {
        clipWords.push(word)
      }
    }
  }

  if (clipWords.length === 0) {
    return {
      adjustedStart: clipStartTime,
      adjustedEnd: clipEndTime,
      adjustmentReason: 'No transcript data available',
      originalStart: clipStartTime,
      originalEnd: clipEndTime
    }
  }

  // Find sentence boundaries (heuristic: capitalized words after gaps > 0.3s)
  const sentenceBoundaries: number[] = [clipWords[0].start]

  for (let i = 1; i < clipWords.length; i++) {
    const prevWord = clipWords[i - 1]
    const currWord = clipWords[i]
    const gap = currWord.start - prevWord.end
    const isCapitalized = currWord.word[0] === currWord.word[0].toUpperCase()

    // Sentence boundary detected
    if ((gap > 0.3 && isCapitalized) || gap > 1.0) {
      sentenceBoundaries.push(currWord.start)
    }
  }

  // Optimize start time
  let adjustedStart = clipStartTime
  let startReason = 'Original start preserved'

  // Find nearest sentence boundary before current start
  const nearbyStartBoundaries = sentenceBoundaries.filter(
    b => b <= clipStartTime && b >= clipStartTime - maxAdjustment
  )

  if (nearbyStartBoundaries.length > 0) {
    const bestStart = nearbyStartBoundaries[nearbyStartBoundaries.length - 1]
    const firstWord = clipWords.find(w => w.start >= bestStart)

    // Only adjust if it improves the hook (doesn't start with filler)
    if (firstWord && !FILLER_WORDS.has(firstWord.word.toLowerCase())) {
      adjustedStart = bestStart
      startReason = 'Aligned to sentence boundary'
    }
  }

  // Optimize end time
  let adjustedEnd = clipEndTime
  let endReason = 'Original end preserved'

  // Find sentence boundaries near current end
  const nearbyEndBoundaries = sentenceBoundaries.filter(
    b => b >= clipEndTime - 0.5 && b <= clipEndTime + maxAdjustment
  )

  if (nearbyEndBoundaries.length > 0) {
    // End just before the next sentence starts (complete thought)
    adjustedEnd = nearbyEndBoundaries[0] - 0.2
    endReason = 'Aligned to sentence boundary'
  } else {
    // No nearby boundary, add padding after last word
    const lastWord = clipWords
      .filter(w => w.start < clipEndTime)
      .sort((a, b) => b.end - a.end)[0]

    if (lastWord && clipEndTime - lastWord.end < 0.3) {
      adjustedEnd = lastWord.end + 0.5
      endReason = 'Added breathing room after last word'
    }
  }

  // Ensure adjusted clip meets minimum duration
  const minDuration = 8 // seconds
  if (adjustedEnd - adjustedStart < minDuration) {
    adjustedEnd = adjustedStart + Math.max(minDuration, clipDuration)
    endReason = 'Extended to meet minimum duration'
  }

  return {
    adjustedStart,
    adjustedEnd,
    adjustmentReason: `Start: ${startReason}. End: ${endReason}`,
    originalStart: clipStartTime,
    originalEnd: clipEndTime
  }
}

/**
 * Apply hook analysis to a moment's score
 * Boosts score for strong hooks, penalizes weak hooks
 */
export function applyHookScore(
  baseScore: number,
  hookAnalysis: HookAnalysis,
  hookWeight: number = 0.2 // 20% weight on final score
): number {
  const hookContribution = hookAnalysis.hookScore * hookWeight
  const adjustedScore = baseScore + hookContribution

  return Math.round(Math.max(0, Math.min(100, adjustedScore)))
}

/**
 * Filter out clips with weak hooks below threshold
 */
export function filterWeakHooks(
  moments: Array<{ hookScore?: number; score: number }>,
  minHookScore: number = 30
): typeof moments {
  return moments.filter(m => {
    // If no hook score, keep it (might not have transcript yet)
    if (m.hookScore === undefined) return true

    // Filter out weak hooks
    return m.hookScore >= minHookScore
  })
}
