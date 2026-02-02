/**
 * Transcript Analysis Module
 *
 * Analyzes transcribed speech using LLM to detect:
 * - Funny/witty moments
 * - Intense/dramatic moments
 * - Quotable phrases
 * - Emotional peaks
 * - Narrative hooks
 */

import { TranscriptionResult, TranscriptionSegment } from '../captions/transcribe'

export interface TranscriptMoment {
  timestamp: number // seconds
  duration: number // duration of the moment
  hydeScore: number // 0-100
  type: 'funny' | 'intense' | 'quotable' | 'emotional' | 'narrative'
  excerpt: string // the actual quote
  reasoning: string // why this moment is interesting
  confidence: number // LLM confidence (0-1)
}

export interface TranscriptAnalysisConfig {
  windowSize: number // seconds per context window
  stepSize: number // seconds between analysis windows
  minSegmentLength: number // minimum words to consider
  maxSegmentLength: number // maximum words per analysis
  llmModel: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo'
  temperature: number // LLM temperature for analysis
}

const DEFAULT_CONFIG: TranscriptAnalysisConfig = {
  windowSize: 30,
  stepSize: 10,
  minSegmentLength: 10,
  maxSegmentLength: 500,
  llmModel: 'gpt-4-turbo',
  temperature: 0.3, // Lower for consistent analysis
}

interface AnalysisChunk {
  text: string
  startTime: number
  endTime: number
  segments: TranscriptionSegment[]
}

/**
 * Prepare transcript chunks for LLM analysis
 */
function prepareAnalysisChunks(
  transcription: TranscriptionResult,
  config: TranscriptAnalysisConfig
): AnalysisChunk[] {
  const chunks: AnalysisChunk[] = []
  const { segments } = transcription

  if (segments.length === 0) return []

  // Create overlapping windows for context
  for (let i = 0; i < segments.length; ) {
    const startTime = segments[i].start
    const endTime = startTime + config.windowSize

    // Collect segments within this window
    const windowSegments: TranscriptionSegment[] = []
    let j = i
    let wordCount = 0

    while (j < segments.length && segments[j].start < endTime) {
      windowSegments.push(segments[j])
      wordCount += segments[j].text.split(/\s+/).length
      j++

      // Stop if we've exceeded max words
      if (wordCount >= config.maxSegmentLength) break
    }

    // Only create chunk if meets minimum length
    if (wordCount >= config.minSegmentLength && windowSegments.length > 0) {
      chunks.push({
        text: windowSegments.map(s => s.text).join(' '),
        startTime: windowSegments[0].start,
        endTime: windowSegments[windowSegments.length - 1].end,
        segments: windowSegments,
      })
    }

    // Move forward by step size
    const stepTime = startTime + config.stepSize
    while (i < segments.length && segments[i].start < stepTime) {
      i++
    }
    if (i === segments.findIndex(s => s.start >= startTime)) {
      i++ // Ensure progress
    }
  }

  return chunks
}

/**
 * Analyze a chunk of transcript using LLM
 */
async function analyzeChunkWithLLM(
  chunk: AnalysisChunk,
  apiKey: string,
  config: TranscriptAnalysisConfig
): Promise<TranscriptMoment[]> {
  const systemPrompt = `You are an expert at analyzing gaming/streaming content transcripts to identify clip-worthy moments.

Analyze the provided transcript segment and identify moments that would make great clips for social media (TikTok, YouTube Shorts, etc).

Look for:
1. FUNNY moments - Jokes, unexpected humor, comedic timing, witty comebacks
2. INTENSE moments - Exciting gameplay, clutch plays, dramatic reactions
3. QUOTABLE moments - Memorable one-liners, catchphrases, relatable statements
4. EMOTIONAL moments - Genuine reactions, vulnerability, excitement, frustration
5. NARRATIVE moments - Story hooks, plot developments, interesting revelations

For each moment you identify:
- Score it 0-100 (how clip-worthy is it?)
- Classify the type (funny/intense/quotable/emotional/narrative)
- Extract the exact quote
- Explain WHY it's interesting in one sentence
- Rate your confidence 0-1

Respond with ONLY a JSON array, no other text:
[{
  "timestamp": <seconds from start>,
  "duration": <length in seconds>,
  "score": <0-100>,
  "type": "funny|intense|quotable|emotional|narrative",
  "excerpt": "exact quote",
  "reasoning": "why this is clip-worthy",
  "confidence": <0-1>
}]

If no moments are clip-worthy, return an empty array: []`

  const userPrompt = `Analyze this transcript segment (starts at ${chunk.startTime.toFixed(1)}s):

"${chunk.text}"

Identify the most clip-worthy moments.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: config.temperature,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const result = await response.json()
    const content = result.choices[0]?.message?.content

    if (!content) return []

    // Parse JSON response
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      console.warn('Failed to parse LLM response as JSON:', content)
      return []
    }

    // Handle both array and object with moments array
    const momentsArray = Array.isArray(parsed) ? parsed : ((parsed as { moments?: unknown[] }).moments || [])

    // Transform to TranscriptMoment format
    return momentsArray
      .filter((m: unknown): m is Record<string, unknown> => {
        return typeof m === 'object' && m !== null && 'score' in m && typeof (m as { score: unknown }).score === 'number' && (m as { score: number }).score >= 30
      })
      .map((m) => ({
        timestamp: chunk.startTime + (typeof m.timestamp === 'number' ? m.timestamp : 0),
        duration: typeof m.duration === 'number' ? m.duration : 10,
        hydeScore: Math.round(Math.min(Math.max(typeof m.score === 'number' ? m.score : 0, 0), 100)),
        type: (m.type === 'funny' || m.type === 'intense' || m.type === 'quotable' || m.type === 'emotional' || m.type === 'narrative') ? m.type : 'quotable',
        excerpt: typeof m.excerpt === 'string' ? m.excerpt : '',
        reasoning: typeof m.reasoning === 'string' ? m.reasoning : '',
        confidence: Math.min(Math.max(typeof m.confidence === 'number' ? m.confidence : 0.5, 0), 1),
      }))
  } catch (error) {
    console.error('Error analyzing chunk with LLM:', error)
    return []
  }
}

/**
 * Analyze transcript and find clip-worthy moments using LLM
 */
export async function analyzeTranscript(
  transcription: TranscriptionResult,
  apiKey: string,
  config: Partial<TranscriptAnalysisConfig> = {}
): Promise<TranscriptMoment[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (!transcription.segments || transcription.segments.length === 0) {
    return []
  }

  // Prepare chunks for analysis
  const chunks = prepareAnalysisChunks(transcription, cfg)

  if (chunks.length === 0) return []

  // Analyze each chunk with LLM
  const allMoments: TranscriptMoment[] = []

  for (const chunk of chunks) {
    try {
      const moments = await analyzeChunkWithLLM(chunk, apiKey, cfg)
      allMoments.push(...moments)
    } catch (error) {
      console.error(`Error analyzing chunk at ${chunk.startTime}s:`, error)
      // Continue with other chunks
    }
  }

  // Deduplicate and merge overlapping moments
  return deduplicateTranscriptMoments(allMoments)
}

/**
 * Remove overlapping moments, keeping higher scored ones
 */
function deduplicateTranscriptMoments(moments: TranscriptMoment[]): TranscriptMoment[] {
  if (moments.length === 0) return []

  // Sort by score (descending) then by timestamp
  const sorted = [...moments].sort((a, b) => {
    if (Math.abs(b.hydeScore - a.hydeScore) > 5) {
      return b.hydeScore - a.hydeScore
    }
    return a.timestamp - b.timestamp
  })

  const result: TranscriptMoment[] = []

  for (const moment of sorted) {
    // Check if this moment overlaps with any already selected
    const overlaps = result.some(existing => {
      const existingStart = existing.timestamp
      const existingEnd = existing.timestamp + existing.duration
      const newStart = moment.timestamp
      const newEnd = moment.timestamp + moment.duration

      // Check for significant overlap (more than 50%)
      const overlapStart = Math.max(existingStart, newStart)
      const overlapEnd = Math.min(existingEnd, newEnd)
      const overlapDuration = Math.max(0, overlapEnd - overlapStart)

      const existingDuration = existingEnd - existingStart
      const newDuration = newEnd - newStart

      return (
        overlapDuration > existingDuration * 0.5 ||
        overlapDuration > newDuration * 0.5
      )
    })

    if (!overlaps) {
      result.push(moment)
    }
  }

  // Sort by timestamp for output
  return result.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get transcript segments within a time range
 */
export function getSegmentsInRange(
  transcription: TranscriptionResult,
  startTime: number,
  endTime: number
): TranscriptionSegment[] {
  return transcription.segments.filter(
    seg => seg.start < endTime && seg.end > startTime
  )
}

/**
 * Extract text from a time range
 */
export function extractTextInRange(
  transcription: TranscriptionResult,
  startTime: number,
  endTime: number
): string {
  const segments = getSegmentsInRange(transcription, startTime, endTime)
  return segments.map(s => s.text).join(' ')
}

/**
 * Calculate transcript-based statistics for a moment
 */
export function getTranscriptStats(
  transcription: TranscriptionResult,
  timestamp: number,
  duration: number
): {
  wordCount: number
  wordsPerSecond: number
  sentenceCount: number
} {
  const text = extractTextInRange(transcription, timestamp, timestamp + duration)

  const words = text.split(/\s+/).filter(w => w.length > 0)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

  return {
    wordCount: words.length,
    wordsPerSecond: words.length / duration,
    sentenceCount: sentences.length,
  }
}
