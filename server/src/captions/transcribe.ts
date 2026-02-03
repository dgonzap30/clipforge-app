/**
 * Transcription Module
 *
 * Generates captions using Whisper (local or API).
 */

/**
 * Default filler words to remove from transcriptions
 */
const DEFAULT_FILLER_WORDS = [
  'um', 'uh', 'umm', 'uhh',
  'like', 'you know', 'i mean',
  'sort of', 'kind of',
  'basically', 'actually', 'literally'
]

/**
 * Minimum gap duration (in seconds) to preserve as a natural pause
 */
const NATURAL_PAUSE_THRESHOLD = 1.0

export interface TranscriptionWord {
  word: string
  start: number // seconds
  end: number // seconds
  confidence: number
}

export interface TranscriptionSegment {
  text: string
  start: number
  end: number
  words: TranscriptionWord[]
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  language: string
  duration: number
}

export interface TranscribeConfig {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large'
  language?: string
  wordTimestamps?: boolean
  removeFillers?: boolean
  customFillerWords?: string[]
}

export interface CaptionAnimations {
  bounce: boolean
  glow: boolean
  fadeIn: boolean
  intensity: 'subtle' | 'medium' | 'strong'
}

export interface CaptionStyle {
  fontName: string
  fontSize: number
  primaryColor: string
  highlightColor: string
  outlineColor: string
  outlineWidth: number
  position: 'bottom' | 'center' | 'top'
  borderStyle?: number
  textTransform?: 'uppercase' | 'lowercase' | 'none'
}

export const CAPTION_PRESETS: Record<string, CaptionStyle> = {
  'bold-pop': {
    fontName: 'Arial Black',
    fontSize: 48,
    primaryColor: '&HFFFFFF', // White
    highlightColor: '&H00FFFF', // Yellow (BGR)
    outlineColor: '&H000000', // Black
    outlineWidth: 3,
    position: 'bottom',
    borderStyle: 1,
    textTransform: 'none',
  },
  'clean-minimal': {
    fontName: 'Helvetica',
    fontSize: 42,
    primaryColor: '&HFFFFFF', // White
    highlightColor: '&HFFFF00', // Cyan (BGR)
    outlineColor: '&H808080', // Gray
    outlineWidth: 2,
    position: 'bottom',
    borderStyle: 1,
    textTransform: 'none',
  },
  'hormozi': {
    fontName: 'Impact',
    fontSize: 52,
    primaryColor: '&HFFFFFF', // White
    highlightColor: '&H0080FF', // Orange (BGR)
    outlineColor: '&H000000', // Black
    outlineWidth: 4,
    position: 'center',
    borderStyle: 1,
    textTransform: 'uppercase',
  },
  'neon-glow': {
    fontName: 'Arial',
    fontSize: 46,
    primaryColor: '&HFFFF00', // Cyan (BGR)
    highlightColor: '&HFF00FF', // Magenta (BGR)
    outlineColor: '&HFF00FF', // Magenta (BGR)
    outlineWidth: 5,
    position: 'bottom',
    borderStyle: 3, // Glow effect
    textTransform: 'none',
  },
  'comic': {
    fontName: 'Comic Sans MS',
    fontSize: 44,
    primaryColor: '&HFFFFFF', // White
    highlightColor: '&H00FF00', // Lime (BGR)
    outlineColor: '&H000000', // Black
    outlineWidth: 3,
    position: 'bottom',
    borderStyle: 1,
    textTransform: 'none',
  },
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeWithWhisperAPI(
  audioPath: string,
  apiKey: string,
  config: TranscribeConfig = {}
): Promise<TranscriptionResult> {
  const { model: _model = 'base', language, wordTimestamps: _wordTimestamps = true } = config
  
  const formData = new FormData()
  
  // Read audio file
  const audioFile = Bun.file(audioPath)
  formData.append('file', audioFile)
  formData.append('model', `whisper-1`)
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')
  
  if (language) {
    formData.append('language', language)
  }
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Whisper API error: ${error}`)
  }
  
  const result = await response.json()

  // Transform to our format
  const transcriptionResult: TranscriptionResult = {
    text: result.text,
    segments: result.segments?.map((seg: any) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      words: seg.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.probability || 1,
      })) || [],
    })) || [],
    language: result.language || 'en',
    duration: result.duration || 0,
  }

  // Apply filler word removal if enabled
  return removeFillerWords(transcriptionResult, config)
}

/**
 * Transcribe using local Whisper installation
 * Requires whisper CLI to be installed
 */
export async function transcribeWithLocalWhisper(
  audioPath: string,
  config: TranscribeConfig = {}
): Promise<TranscriptionResult> {
  const { model = 'base', language } = config
  const { $ } = await import('bun')
  
  const outputDir = '/tmp/whisper_output'
  
  // Build command
  let cmd = `whisper ${audioPath} --model ${model} --output_format json --output_dir ${outputDir}`
  
  if (language) {
    cmd += ` --language ${language}`
  }
  
  cmd += ' --word_timestamps True'
  
  await $`sh -c ${cmd}`
  
  // Read output JSON
  const baseName = audioPath.split('/').pop()?.replace(/\.[^.]+$/, '')
  const outputPath = `${outputDir}/${baseName}.json`
  
  const output = await Bun.file(outputPath).json()

  const transcriptionResult: TranscriptionResult = {
    text: output.text,
    segments: output.segments?.map((seg: any) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      words: seg.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.probability || 1,
      })) || [],
    })) || [],
    language: output.language || 'en',
    duration: output.duration || 0,
  }

  // Apply filler word removal if enabled
  return removeFillerWords(transcriptionResult, config)
}

/**
 * Remove filler words from transcription result
 */
export function removeFillerWords(
  result: TranscriptionResult,
  config: TranscribeConfig = {}
): TranscriptionResult {
  if (!config.removeFillers) {
    return result
  }

  const fillerWords = config.customFillerWords || DEFAULT_FILLER_WORDS
  const fillerSet = new Set(fillerWords.map(w => w.toLowerCase().trim()))

  const cleanedSegments: TranscriptionSegment[] = []

  for (const segment of result.segments) {
    if (!segment.words || segment.words.length === 0) {
      // Keep segments without word-level timing unchanged
      cleanedSegments.push(segment)
      continue
    }

    const filteredWords: TranscriptionWord[] = []
    let timeOffset = 0

    for (let i = 0; i < segment.words.length; i++) {
      const word = segment.words[i]
      const normalizedWord = word.word.toLowerCase().trim()

      // Check if word is a filler
      const isFiller = fillerSet.has(normalizedWord)

      // Don't remove if it's after a sentence-ending punctuation (new sentence)
      const isAfterSentenceEnd = i > 0 && /[.!?]$/.test(segment.words[i - 1].word)

      // Don't remove if word has high confidence (likely stressed/emphasized)
      // Threshold: 0.95 confidence indicates emphasis
      const isEmphasized = word.confidence >= 0.95

      const shouldKeep = !isFiller || isAfterSentenceEnd || isEmphasized

      if (!shouldKeep) {
        // Remove this filler word
        const nextWord = segment.words[i + 1]
        if (nextWord) {
          const gapDuration = nextWord.start - word.end

          // Only add to offset if gap is less than natural pause threshold
          if (gapDuration < NATURAL_PAUSE_THRESHOLD) {
            timeOffset += (word.end - word.start)
          }
        } else {
          // Last word in segment, add to offset
          timeOffset += (word.end - word.start)
        }
        continue
      }

      // Keep this word, adjust timing
      const adjustedWord: TranscriptionWord = {
        ...word,
        start: word.start - timeOffset,
        end: word.end - timeOffset,
      }

      filteredWords.push(adjustedWord)
    }

    // Only add segment if it has words remaining
    if (filteredWords.length > 0) {
      // Reconstruct segment text from filtered words
      const newText = filteredWords.map(w => w.word).join(' ')

      cleanedSegments.push({
        ...segment,
        text: newText,
        words: filteredWords,
        end: filteredWords[filteredWords.length - 1].end,
      })
    }
  }

  // Reconstruct full text
  const newFullText = cleanedSegments.map(s => s.text).join(' ')

  return {
    ...result,
    text: newFullText,
    segments: cleanedSegments,
  }
}

/**
 * Generate SRT subtitle file
 */
export function generateSRT(segments: TranscriptionSegment[]): string {
  const lines: string[] = []
  
  segments.forEach((segment, index) => {
    lines.push(String(index + 1))
    lines.push(`${formatSRTTime(segment.start)} --> ${formatSRTTime(segment.end)}`)
    lines.push(segment.text.trim())
    lines.push('')
  })
  
  return lines.join('\n')
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`
}

function pad(num: number, length: number = 2): string {
  return String(num).padStart(length, '0')
}

/**
 * Emoji keyword mapping
 * Maps common gaming/streaming keywords to contextual emojis
 */
const EMOJI_MAP: Record<string, string> = {
  'fire': '🔥',
  'crazy': '😱',
  'insane': '🤯',
  'wow': '😮',
  'lol': '😂',
  'haha': '😂',
  'dead': '💀',
  'gg': '🎮',
  'win': '🏆',
  'lose': '😢',
  'clutch': '⚡',
  'no way': '😲',
  'lets go': '🚀',
  'poggers': '😎',
  'omg': '😱',
  'wtf': '❓',
  'bruh': '💀',
  'lmao': '😂',
  'lmfao': '😂',
  'laugh': '😂',
  'laughing': '😂',
  'pog': '😎',
  'sheesh': '🔥',
  'lit': '🔥',
  'amazing': '🤩',
  'nice': '👍',
  'good': '👍',
  'bad': '👎',
  'awful': '👎',
  'terrible': '👎',
  'sick': '🔥',
  'beast': '💪',
  'destroyed': '💥',
  'rekt': '💀',
  'noob': '🤦',
  'pro': '😎',
  'god': '👑',
  'king': '👑',
  'queen': '👑',
  'love': '❤️',
  'heart': '❤️',
  'pain': '😭',
  'crying': '😭',
  'cry': '😭',
  'screaming': '😱',
  'scream': '😱',
  'yell': '📢',
  'rage': '😤',
  'angry': '😤',
  'mad': '😤',
  'happy': '😊',
  'sad': '😢',
  'think': '🤔',
  'thinking': '🤔',
  'confused': '😕',
  'brain': '🧠',
  'smart': '🧠',
  'money': '💰',
  'cash': '💰',
  'rich': '💰',
  'broke': '😭',
  'stonks': '📈',
  'cracked': '⚡',
  'goat': '🐐',
  'boss': '👑',
  'legend': '⭐',
  'legendary': '⭐',
  'epic': '🎮',
  'fail': '😬',
  'oops': '😬',
  'oof': '😬',
  'yikes': '😬',
  'ez': '😎',
  'easy': '😎',
  'hard': '😰',
  'difficult': '😰',
  'impossible': '🚫',
  'possible': '✅',
  'yes': '✅',
  'yeah': '✅',
  'yep': '✅',
  'nope': '❌',
  'never': '❌',
  'always': '💯',
  'perfect': '💯',
  'flawless': '💯',
  'victory': '🏆',
  'defeat': '😭',
}

/**
 * Detects if text contains laughter indicators
 */
function detectLaughter(text: string): boolean {
  const lowerText = text.toLowerCase()
  const laughterPatterns = [
    '[laughter]',
    '[laughing]',
    '[laughs]',
    'hahaha',
    'hehehe',
    'ahahaha',
  ]
  return laughterPatterns.some(pattern => lowerText.includes(pattern))
}

/**
 * Find emoji matches for a word or phrase
 */
function findEmojiForText(text: string): string | null {
  const lowerText = text.toLowerCase().trim()

  // Check for exact match
  if (EMOJI_MAP[lowerText]) {
    return EMOJI_MAP[lowerText]
  }

  // Check for laughter
  if (detectLaughter(lowerText)) {
    return '😂'
  }

  return null
}

/**
 * Find emoji matches in a segment, considering multi-word phrases
 */
function findEmojiMatches(
  words: TranscriptionWord[]
): Array<{ wordIndex: number; emoji: string; phraseLength: number }> {
  const matches: Array<{ wordIndex: number; emoji: string; phraseLength: number }> = []

  // Check for multi-word phrases first
  const multiWordPhrases = ['no way', 'lets go']
  for (let i = 0; i < words.length - 1; i++) {
    const twoWords = `${words[i].word} ${words[i + 1].word}`.toLowerCase().trim()
    if (multiWordPhrases.includes(twoWords)) {
      const emoji = EMOJI_MAP[twoWords]
      if (emoji) {
        matches.push({ wordIndex: i, emoji, phraseLength: 2 })
        i++ // Skip next word since it's part of the phrase
        continue
      }
    }
  }

  // Check for single-word matches
  for (let i = 0; i < words.length; i++) {
    // Skip if already part of a multi-word match
    if (matches.some(m => i >= m.wordIndex && i < m.wordIndex + m.phraseLength)) {
      continue
    }

    const emoji = findEmojiForText(words[i].word)
    if (emoji) {
      matches.push({ wordIndex: i, emoji, phraseLength: 1 })
    }
  }

  return matches
}

/**
 * Generate ASS subtitle file with TikTok-style word highlighting
 */
export function generateTikTokASS(
  segments: TranscriptionSegment[],
  options: {
    preset?: keyof typeof CAPTION_PRESETS
    fontSize?: number
    fontName?: string
    primaryColor?: string // BGR format for ASS
    highlightColor?: string
    outlineColor?: string
    position?: 'bottom' | 'center' | 'top'
    animations?: CaptionAnimations
    outlineWidth?: number
    borderStyle?: number
    textTransform?: 'uppercase' | 'lowercase' | 'none'
    emojis?: boolean
    emojiAnimation?: boolean
  } = {}
): string {
  // Load preset if specified, otherwise use defaults
  const preset = options.preset ? CAPTION_PRESETS[options.preset] : CAPTION_PRESETS['bold-pop']

  const {
    fontSize = preset.fontSize,
    fontName = preset.fontName,
    primaryColor = preset.primaryColor,
    highlightColor = preset.highlightColor,
    outlineColor = preset.outlineColor,
    position = preset.position,
    outlineWidth = preset.outlineWidth,
    borderStyle = preset.borderStyle ?? 1,
    textTransform = preset.textTransform ?? 'none',
    animations = {
      bounce: true,
      glow: true,
      fadeIn: true,
      intensity: 'medium',
    },
    emojis = false,
    emojiAnimation = true,
  } = options

  const yPosition = position === 'bottom' ? 800 : position === 'top' ? 200 : 540
  const emojiFontSize = Math.floor(fontSize * 1.25) // Emojis slightly larger

  // Calculate animation parameters based on intensity
  const getAnimationParams = () => {
    const intensityMap = {
      subtle: { scalePercent: 105, glowOutline: 4, fadeAlpha: 200, duration: 150 },
      medium: { scalePercent: 110, glowOutline: 5, fadeAlpha: 128, duration: 100 },
      strong: { scalePercent: 120, glowOutline: 6, fadeAlpha: 80, duration: 80 },
    }
    return intensityMap[animations.intensity]
  }

  const animParams = getAnimationParams()

  // Build styles section
  let stylesSection = `Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},0,2,10,10,${yPosition},1
Style: Highlight,${fontName},${fontSize},${highlightColor},${primaryColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},0,2,10,10,${yPosition},1`

  if (emojis) {
    stylesSection += `\nStyle: Emoji,Arial,${emojiFontSize},&HFFFFFF,&HFFFFFF,&H000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,${yPosition},1`
  }

  const header = `[Script Info]
Title: ClipForge Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${stylesSection}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  // Helper to apply text transformation
  const transformText = (text: string): string => {
    switch (textTransform) {
      case 'uppercase':
        return text.toUpperCase()
      case 'lowercase':
        return text.toLowerCase()
      default:
        return text
    }
  }

  const events: string[] = []

  for (const segment of segments) {
    if (!segment.words || segment.words.length === 0) {
      // No word-level timing, show whole segment
      events.push(
        `Dialogue: 0,${formatASSTime(segment.start)},${formatASSTime(segment.end)},Default,,0,0,0,,${escapeASS(transformText(segment.text))}`
      )
      continue
    }

    // Find emoji matches if enabled
    const emojiMatches = emojis ? findEmojiMatches(segment.words) : []

    // Word-by-word highlighting
    for (let i = 0; i < segment.words.length; i++) {
      const word = segment.words[i]

      // Build text with current word highlighted
      const before = segment.words.slice(0, i).map(w => transformText(w.word)).join(' ')
      const current = transformText(word.word)
      const after = segment.words.slice(i + 1).map(w => transformText(w.word)).join(' ')

      // Calculate word duration in milliseconds for animation timing
      const wordDuration = (segment.words[i + 1]?.start || word.end) - word.start
      const durationMs = Math.round(wordDuration * 1000)

      // Build animation tags for the highlighted word
      let highlightAnimations = ''

      if (animations.bounce) {
        // Bounce effect: scale up then back down
        const bounceUp = animParams.duration
        const bounceDown = animParams.duration * 2
        highlightAnimations += `{\\t(0,${bounceUp},\\fscx${animParams.scalePercent}\\fscy${animParams.scalePercent})\\t(${bounceUp},${bounceDown},\\fscx100\\fscy100)}`
      }

      if (animations.glow) {
        // Glow pulse: increase outline width then restore
        const glowTime = Math.max(animParams.duration, durationMs - animParams.duration)
        highlightAnimations += `{\\t(0,${animParams.duration},\\bord${animParams.glowOutline})\\t(${glowTime},${durationMs},\\bord3)}`
      }

      if (animations.fadeIn) {
        // Fade-in effect for new words
        highlightAnimations += `{\\fade(${animParams.fadeAlpha},0,0,0,0,${animParams.duration})}`
      }

      const text = [
        before ? `{\\c${primaryColor}}${escapeASS(before)} ` : '',
        `${highlightAnimations}{\\c${highlightColor}}${escapeASS(current)}`,
        after ? `{\\c${primaryColor}} ${escapeASS(after)}` : '',
      ].join('')

      const endTime = segment.words[i + 1]?.start || word.end

      events.push(
        `Dialogue: 0,${formatASSTime(word.start)},${formatASSTime(endTime)},Default,,0,0,0,,${text}`
      )
    }

    // Add emoji events
    for (const match of emojiMatches) {
      const matchWord = segment.words[match.wordIndex]
      if (!matchWord) continue

      // Calculate approximate position
      // Estimate word width (rough approximation)
      const charWidth = fontSize * 0.6
      const wordsBeforeCurrent = segment.words.slice(0, match.wordIndex)
      const textBeforeWidth = wordsBeforeCurrent.reduce((sum, w) => sum + (w.word.length * charWidth) + charWidth, 0)
      const currentWordWidth = matchWord.word.length * charWidth

      // Position emoji to the right of the word
      const xPosition = 540 + textBeforeWidth + currentWordWidth + (fontSize * 0.5) // Center X (540) + offset

      // Duration: show emoji for the matched word(s) duration
      const lastWordInPhrase = segment.words[match.wordIndex + match.phraseLength - 1]
      const emojiStart = matchWord.start
      const emojiEnd = lastWordInPhrase ? lastWordInPhrase.end : matchWord.end
      const emojiDuration = (emojiEnd - emojiStart) * 1000 // Convert to milliseconds

      // Build emoji dialogue with animation if enabled
      let emojiText = match.emoji
      if (emojiAnimation) {
        // Scale up animation: 0-200ms scale to 120%, 200-400ms settle to 100%
        const animDuration = Math.min(200, emojiDuration / 2)
        emojiText = `{\\pos(${Math.floor(xPosition)},${yPosition})\\t(0,${animDuration},\\fscx120\\fscy120)\\t(${animDuration},${animDuration * 2},\\fscx100\\fscy100)}${match.emoji}`
      } else {
        emojiText = `{\\pos(${Math.floor(xPosition)},${yPosition})}${match.emoji}`
      }

      events.push(
        `Dialogue: 1,${formatASSTime(emojiStart)},${formatASSTime(emojiEnd)},Emoji,,0,0,0,,${emojiText}`
      )
    }
  }

  return header + events.join('\n')
}

function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  return `${hours}:${pad(minutes)}:${secs.toFixed(2).padStart(5, '0')}`
}

function escapeASS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, '\\N')
}

/**
 * Burn captions into video using FFmpeg
 */
export async function burnCaptions(
  videoPath: string,
  subtitlePath: string,
  outputPath: string,
  options: {
    format?: 'srt' | 'ass'
  } = {}
): Promise<void> {
  const { $ } = await import('bun')
  const { format = 'ass' } = options
  
  if (format === 'ass') {
    // ASS supports styling
    await $`ffmpeg -i ${videoPath} -vf "ass=${subtitlePath}" \
      -c:v libx264 -crf 20 -c:a copy -y ${outputPath}`
  } else {
    // SRT with default styling
    await $`ffmpeg -i ${videoPath} -vf "subtitles=${subtitlePath}:force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2'" \
      -c:v libx264 -crf 20 -c:a copy -y ${outputPath}`
  }
}
