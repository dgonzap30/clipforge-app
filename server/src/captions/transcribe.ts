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
    outlineWidth?: number
    borderStyle?: number
    textTransform?: 'uppercase' | 'lowercase' | 'none'
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
  } = options
  
  const yPosition = position === 'bottom' ? 800 : position === 'top' ? 200 : 540

  const header = `[Script Info]
Title: ClipForge Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},${highlightColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},0,2,10,10,${yPosition},1
Style: Highlight,${fontName},${fontSize},${highlightColor},${primaryColor},${outlineColor},&H80000000,-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},0,2,10,10,${yPosition},1

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
    
    // Word-by-word highlighting
    for (let i = 0; i < segment.words.length; i++) {
      const word = segment.words[i]

      // Build text with current word highlighted
      const before = segment.words.slice(0, i).map(w => transformText(w.word)).join(' ')
      const current = transformText(word.word)
      const after = segment.words.slice(i + 1).map(w => transformText(w.word)).join(' ')

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
