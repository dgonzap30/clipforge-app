/**
 * LLM Client for Transcript Analysis
 *
 * Supports both OpenAI and Anthropic Claude for analyzing video transcripts
 * to identify B-roll insertion opportunities.
 */

import type { TranscriptionResult } from '../captions/transcribe'

export interface BRollSuggestion {
  timestamp: number // seconds from start
  duration: number // suggested duration in seconds
  searchQuery: string // Pexels search query
  context: string // Why this B-roll makes sense
}

export interface TranscriptAnalysisResult {
  suggestions: BRollSuggestion[]
  totalSuggestions: number
}

export type LLMProvider = 'openai' | 'claude'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model?: string
}

/**
 * Analyze transcript and generate B-roll suggestions using LLM
 */
export async function analyzeTranscriptForBRoll(
  transcription: TranscriptionResult,
  config: LLMConfig
): Promise<TranscriptAnalysisResult> {
  const { provider, apiKey, model } = config

  // Build prompt for LLM
  const prompt = buildBRollPrompt(transcription)

  let suggestions: BRollSuggestion[] = []

  if (provider === 'openai') {
    suggestions = await analyzeWithOpenAI(prompt, apiKey, model || 'gpt-4o-mini')
  } else if (provider === 'claude') {
    suggestions = await analyzeWithClaude(prompt, apiKey, model || 'claude-3-5-sonnet-20241022')
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`)
  }

  return {
    suggestions,
    totalSuggestions: suggestions.length,
  }
}

/**
 * Build prompt for LLM to analyze transcript
 */
function buildBRollPrompt(transcription: TranscriptionResult): string {
  // Format transcript with timestamps
  const formattedSegments = transcription.segments
    .map(seg => {
      const timestamp = formatTimestamp(seg.start)
      return `[${timestamp}] ${seg.text.trim()}`
    })
    .join('\n')

  return `You are a video editor assistant analyzing a video transcript to identify opportunities for B-roll footage insertion.

B-roll is supplemental footage that visually supports what's being discussed in the video. It should be inserted when:
- The speaker mentions specific objects, places, or activities
- Abstract concepts would benefit from visual representation
- The video would be enhanced by showing what's being discussed rather than just the speaker

Analyze the following transcript and identify moments where B-roll would enhance the video.

For each suggestion, provide:
1. The timestamp (in seconds) where B-roll should start
2. Suggested duration (typically 3-8 seconds)
3. A specific search query for stock footage (be descriptive but concise)
4. Brief context explaining why this B-roll makes sense

TRANSCRIPT:
${formattedSegments}

Respond with a JSON array of suggestions. Each suggestion should have this format:
{
  "timestamp": <seconds>,
  "duration": <seconds>,
  "searchQuery": "<search query>",
  "context": "<explanation>"
}

Only return the JSON array, no additional text. If no B-roll opportunities are found, return an empty array [].`
}

/**
 * Format timestamp as MM:SS
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Analyze with OpenAI
 */
async function analyzeWithOpenAI(
  prompt: string,
  apiKey: string,
  model: string
): Promise<BRollSuggestion[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a video editing assistant. Respond only with valid JSON arrays.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content

  if (!content) {
    return []
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(content)
    // Handle both direct array and object with suggestions array
    const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || [])
    return validateSuggestions(suggestions)
  } catch (err) {
    console.warn('[LLM] Failed to parse OpenAI response:', err)
    return []
  }
}

/**
 * Analyze with Claude
 */
async function analyzeWithClaude(
  prompt: string,
  apiKey: string,
  model: string
): Promise<BRollSuggestion[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${error}`)
  }

  const result = await response.json()
  const content = result.content?.[0]?.text

  if (!content) {
    return []
  }

  // Extract JSON from response (Claude may include explanation text)
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.warn('[LLM] No JSON array found in Claude response')
      return []
    }

    const suggestions = JSON.parse(jsonMatch[0])
    return validateSuggestions(suggestions)
  } catch (err) {
    console.warn('[LLM] Failed to parse Claude response:', err)
    return []
  }
}

/**
 * Validate and normalize suggestions
 */
function validateSuggestions(suggestions: any[]): BRollSuggestion[] {
  if (!Array.isArray(suggestions)) {
    return []
  }

  return suggestions
    .filter(s => {
      return (
        typeof s === 'object' &&
        s !== null &&
        typeof s.timestamp === 'number' &&
        typeof s.duration === 'number' &&
        typeof s.searchQuery === 'string' &&
        s.searchQuery.length > 0
      )
    })
    .map(s => ({
      timestamp: s.timestamp,
      duration: Math.max(3, Math.min(10, s.duration)), // Clamp duration 3-10 seconds
      searchQuery: s.searchQuery.trim(),
      context: s.context || '',
    }))
}
