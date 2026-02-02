/**
 * Transcription Module
 * 
 * Generates captions using Whisper (local or API).
 */

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
  return {
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
  
  return {
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
    fontSize?: number
    fontName?: string
    primaryColor?: string // BGR format for ASS
    highlightColor?: string
    outlineColor?: string
    position?: 'bottom' | 'center' | 'top'
    emojis?: boolean
    emojiAnimation?: boolean
  } = {}
): string {
  const {
    fontSize = 48,
    fontName = 'Arial Black',
    primaryColor = '&HFFFFFF', // White
    highlightColor = '&H00FFFF', // Yellow (BGR)
    outlineColor = '&H000000', // Black
    position = 'center',
    emojis = false,
    emojiAnimation = true,
  } = options

  const yPosition = position === 'bottom' ? 800 : position === 'top' ? 200 : 540
  const emojiFontSize = Math.floor(fontSize * 1.25) // Emojis slightly larger

  // Build styles section
  let stylesSection = `Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,${yPosition},1
Style: Highlight,${fontName},${fontSize},${highlightColor},${primaryColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,${yPosition},1`

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

  const events: string[] = []

  for (const segment of segments) {
    if (!segment.words || segment.words.length === 0) {
      // No word-level timing, show whole segment
      events.push(
        `Dialogue: 0,${formatASSTime(segment.start)},${formatASSTime(segment.end)},Default,,0,0,0,,${escapeASS(segment.text)}`
      )
      continue
    }

    // Find emoji matches if enabled
    const emojiMatches = emojis ? findEmojiMatches(segment.words) : []

    // Word-by-word highlighting
    for (let i = 0; i < segment.words.length; i++) {
      const word = segment.words[i]

      // Build text with current word highlighted
      const before = segment.words.slice(0, i).map(w => w.word).join(' ')
      const current = word.word
      const after = segment.words.slice(i + 1).map(w => w.word).join(' ')

      const text = [
        before ? `{\\c${primaryColor}}${escapeASS(before)} ` : '',
        `{\\c${highlightColor}}${escapeASS(current)}`,
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
