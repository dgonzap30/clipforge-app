/**
 * Chat Analysis Module
 * 
 * Analyzes Twitch chat logs to detect "hype moments" based on:
 * - Message velocity (messages per time window)
 * - Emote density (specific hype emotes)
 * - Sentiment shifts
 */

// Popular hype emotes with weights
export const HYPE_EMOTES: Record<string, number> = {
  // Twitch Global
  'PogChamp': 1.5,
  'Pog': 1.3,
  'POGGERS': 1.5,
  'Kreygasm': 1.2,
  'PogU': 1.4,
  'OMEGALUL': 1.3,
  'LULW': 1.2,
  'LUL': 1.0,
  'monkaS': 1.3,
  'monkaW': 1.4,
  'Jebaited': 1.0,
  'HeyGuys': 0.5,
  'Kappa': 0.8,
  'catJAM': 0.9,
  'pepeLaugh': 1.1,
  'Sadge': 0.7,
  'EZ': 1.0,
  'gg': 0.6,
  'GG': 0.6,
  'F': 0.8,
  'Clap': 1.0,
  'HYPERS': 1.6,
  'FeelsGoodMan': 0.9,
  'FeelsBadMan': 0.7,
  'ResidentSleeper': 0.3,
  '4Head': 0.9,
  'BibleThump': 0.8,
  'WutFace': 1.1,
  'NotLikeThis': 1.0,
  
  // Common spam patterns
  '!': 0.3, // Exclamation points
  '?!': 0.5,
  'LETSGO': 1.2,
  'LETS GO': 1.2,
  'INSANE': 1.3,
  'CRAZY': 1.2,
  'OMG': 1.1,
  'WTF': 1.2,
  'WHAT': 1.0,
  'HOW': 1.0,
  'NO WAY': 1.3,
  'NOWAY': 1.3,
}

export interface ChatMessage {
  timestamp: number // seconds into VOD
  username: string
  message: string
  emotes?: string[] // parsed emote names
}

export interface ChatMoment {
  timestamp: number
  velocity: number // messages per window
  emoteScore: number // weighted emote density
  hydeScore: number // combined score (0-100)
  peakMessages: string[] // sample messages from this moment
}

export interface ChatAnalysisConfig {
  windowSize: number // seconds
  stepSize: number // seconds between windows
  minVelocity: number // minimum messages/window to consider
  emoteWeight: number // how much to weight emotes vs velocity
}

const DEFAULT_CONFIG: ChatAnalysisConfig = {
  windowSize: 10,
  stepSize: 2,
  minVelocity: 5,
  emoteWeight: 0.4,
}

/**
 * Analyze chat logs and find hype moments
 */
export function analyzeChatLogs(
  messages: ChatMessage[],
  config: Partial<ChatAnalysisConfig> = {}
): ChatMoment[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  if (messages.length === 0) return []
  
  // Sort by timestamp
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  
  const startTime = sorted[0].timestamp
  const endTime = sorted[sorted.length - 1].timestamp
  
  const moments: ChatMoment[] = []
  
  // Sliding window analysis
  for (let t = startTime; t <= endTime - cfg.windowSize; t += cfg.stepSize) {
    const windowEnd = t + cfg.windowSize
    
    // Get messages in this window
    const windowMessages = sorted.filter(
      m => m.timestamp >= t && m.timestamp < windowEnd
    )
    
    if (windowMessages.length < cfg.minVelocity) continue
    
    // Calculate velocity
    const velocity = windowMessages.length / cfg.windowSize
    
    // Calculate emote score
    let emoteScore = 0
    for (const msg of windowMessages) {
      // Check for known emotes
      for (const [emote, weight] of Object.entries(HYPE_EMOTES)) {
        if (msg.message.includes(emote)) {
          emoteScore += weight
        }
      }
      
      // Check for caps (excitement indicator)
      const capsRatio = (msg.message.match(/[A-Z]/g)?.length || 0) / msg.message.length
      if (capsRatio > 0.7 && msg.message.length > 5) {
        emoteScore += 0.5
      }
      
      // Check for repeated characters (e.g., "AAAAA", "!!!!!!")
      if (/(.)\1{4,}/.test(msg.message)) {
        emoteScore += 0.3
      }
    }
    
    // Normalize emote score per message
    const normalizedEmoteScore = emoteScore / windowMessages.length
    
    // Calculate combined hyde score (0-100)
    const velocityScore = Math.min(velocity / 10, 1) * 100 // cap at 10 msg/sec
    const emoteContribution = Math.min(normalizedEmoteScore * 20, 100)
    
    const hydeScore = Math.round(
      velocityScore * (1 - cfg.emoteWeight) + 
      emoteContribution * cfg.emoteWeight
    )
    
    if (hydeScore >= 20) { // Only include significant moments
      moments.push({
        timestamp: t + cfg.windowSize / 2, // Center of window
        velocity,
        emoteScore: normalizedEmoteScore,
        hydeScore,
        peakMessages: windowMessages.slice(0, 5).map(m => m.message),
      })
    }
  }
  
  // Merge overlapping moments and keep peaks
  return mergeAndFilterMoments(moments, cfg.windowSize)
}

/**
 * Merge overlapping moments and keep only peaks
 */
function mergeAndFilterMoments(moments: ChatMoment[], windowSize: number): ChatMoment[] {
  if (moments.length === 0) return []
  
  const sorted = [...moments].sort((a, b) => a.timestamp - b.timestamp)
  const merged: ChatMoment[] = []
  
  let currentPeak = sorted[0]
  
  for (let i = 1; i < sorted.length; i++) {
    const moment = sorted[i]
    
    // If overlapping, keep the higher score
    if (moment.timestamp - currentPeak.timestamp < windowSize) {
      if (moment.hydeScore > currentPeak.hydeScore) {
        currentPeak = moment
      }
    } else {
      // No overlap, save current peak and start new one
      merged.push(currentPeak)
      currentPeak = moment
    }
  }
  
  merged.push(currentPeak) // Don't forget the last one
  
  return merged
}

/**
 * Parse raw chat log from Twitch
 * 
 * Twitch chat logs typically come from:
 * 1. IRC logs during live stream
 * 2. Third-party services like logs.ivr.fi
 * 3. VOD comment replay API
 */
export function parseChatLog(rawLog: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  const lines = rawLog.split('\n')
  
  for (const line of lines) {
    // Common format: [HH:MM:SS] username: message
    const match = line.match(/\[(\d{2}):(\d{2}):(\d{2})\]\s*(\w+):\s*(.+)/)
    
    if (match) {
      const [, hours, minutes, seconds, username, message] = match
      const timestamp = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds)
      
      messages.push({
        timestamp,
        username,
        message: message.trim(),
      })
    }
  }
  
  return messages
}

/**
 * Fetch chat logs for a VOD
 * 
 * Note: Twitch doesn't provide a direct API for this.
 * Options:
 * 1. Use video comments API (limited)
 * 2. Use third-party services (logs.ivr.fi)
 * 3. Record IRC during live stream
 */
export async function fetchChatLogs(vodId: string): Promise<ChatMessage[]> {
  // TODO: Implement actual chat log fetching
  // For now, return empty array - this needs external service integration
  
  console.log(`Fetching chat logs for VOD ${vodId}...`)
  
  // Option 1: Try Twitch video comments API
  // This is rate-limited and may not have all messages
  
  // Option 2: Try third-party service
  // const response = await fetch(`https://logs.ivr.fi/vod/${vodId}`)
  
  return []
}
