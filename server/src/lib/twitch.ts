import { env } from './env'

const TWITCH_API_BASE = 'https://api.twitch.tv/helix'
const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2'

// Types
export interface TwitchUser {
  id: string
  login: string
  display_name: string
  type: string
  broadcaster_type: string
  description: string
  profile_image_url: string
  offline_image_url: string
  email?: string
  created_at: string
}

export interface TwitchVideo {
  id: string
  stream_id: string | null
  user_id: string
  user_login: string
  user_name: string
  title: string
  description: string
  created_at: string
  published_at: string
  url: string
  thumbnail_url: string
  viewable: string
  view_count: number
  language: string
  type: 'upload' | 'archive' | 'highlight'
  duration: string // "3h24m15s" format
  muted_segments: Array<{ duration: number; offset: number }> | null
}

export interface TwitchClip {
  id: string
  url: string
  embed_url: string
  broadcaster_id: string
  broadcaster_name: string
  creator_id: string
  creator_name: string
  video_id: string
  game_id: string
  language: string
  title: string
  view_count: number
  created_at: string
  thumbnail_url: string
  duration: number // in seconds
  vod_offset: number | null // offset into VOD in seconds
}

export interface TwitchTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string[]
  token_type: string
}

// OAuth URLs
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    redirect_uri: env.TWITCH_REDIRECT_URI,
    response_type: 'code',
    scope: 'user:read:email clips:edit',
    state,
  })
  
  return `${TWITCH_AUTH_BASE}/authorize?${params}`
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code: string): Promise<TwitchTokenResponse> {
  const response = await fetch(`${TWITCH_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.TWITCH_REDIRECT_URI,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }
  
  return response.json()
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<TwitchTokenResponse> {
  const response = await fetch(`${TWITCH_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }
  
  return response.json()
}

// Validate token
export async function validateToken(accessToken: string): Promise<boolean> {
  const response = await fetch(`${TWITCH_AUTH_BASE}/validate`, {
    headers: {
      'Authorization': `OAuth ${accessToken}`,
    },
  })

  return response.ok
}

// App Access Token (for server-side API calls without user context)
let appAccessToken: string | null = null
let appTokenExpiry: number | null = null

export async function getAppAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (appAccessToken && appTokenExpiry && Date.now() < appTokenExpiry) {
    return appAccessToken
  }

  // Request new app access token
  const response = await fetch(`${TWITCH_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get app access token: ${error}`)
  }

  const data = await response.json()
  appAccessToken = data.access_token
  // Set expiry 1 hour before actual expiry as buffer
  appTokenExpiry = Date.now() + (data.expires_in - 3600) * 1000

  return appAccessToken
}

// API client class
export class TwitchClient {
  private accessToken: string
  
  constructor(accessToken: string) {
    this.accessToken = accessToken
  }
  
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${TWITCH_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': env.TWITCH_CLIENT_ID,
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Twitch API error: ${response.status} - ${error}`)
    }
    
    return response.json()
  }
  
  // Get current user
  async getUser(): Promise<TwitchUser> {
    const data = await this.request<{ data: TwitchUser[] }>('/users')
    return data.data[0]
  }
  
  // Get user by ID or login
  async getUserByLogin(login: string): Promise<TwitchUser> {
    const data = await this.request<{ data: TwitchUser[] }>(`/users?login=${login}`)
    if (!data.data[0]) {
      throw new Error(`User not found: ${login}`)
    }
    return data.data[0]
  }
  
  // Get VODs for a user
  async getVideos(userId: string, options: {
    type?: 'all' | 'upload' | 'archive' | 'highlight'
    first?: number
    after?: string
  } = {}): Promise<{ data: TwitchVideo[]; pagination: { cursor?: string } }> {
    const params = new URLSearchParams({
      user_id: userId,
      type: options.type || 'archive',
      first: String(options.first || 20),
    })
    
    if (options.after) {
      params.set('after', options.after)
    }
    
    return this.request(`/videos?${params}`)
  }
  
  // Get specific video by ID
  async getVideo(videoId: string): Promise<TwitchVideo | null> {
    const data = await this.request<{ data: TwitchVideo[] }>(`/videos?id=${videoId}`)
    return data.data[0] || null
  }
  
  // Get clips for a broadcaster
  async getClips(broadcasterId: string, options: {
    first?: number
    started_at?: string
    ended_at?: string
  } = {}): Promise<{ data: TwitchClip[]; pagination: { cursor?: string } }> {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: String(options.first || 20),
    })

    if (options.started_at) params.set('started_at', options.started_at)
    if (options.ended_at) params.set('ended_at', options.ended_at)

    return this.request(`/clips?${params}`)
  }

  // Get clips for a specific VOD
  async getClipsForVOD(videoId: string): Promise<TwitchClip[]> {
    // First get the video to find the time range
    const video = await this.getVideo(videoId)
    if (!video) {
      return []
    }

    // Calculate time range for clips (VOD created_at to created_at + duration)
    const startTime = new Date(video.created_at)
    const durationSeconds = parseTwitchDuration(video.duration)
    const endTime = new Date(startTime.getTime() + durationSeconds * 1000)

    // Fetch all clips in that time range
    const allClips: TwitchClip[] = []
    let cursor: string | undefined = undefined

    do {
      const params = new URLSearchParams({
        broadcaster_id: video.user_id,
        started_at: startTime.toISOString(),
        ended_at: endTime.toISOString(),
        first: '100', // max per request
      })

      if (cursor) {
        params.set('after', cursor)
      }

      const response = await this.request<{ data: TwitchClip[]; pagination: { cursor?: string } }>(
        `/clips?${params}`
      )

      // Filter to only clips from this specific VOD
      const vodClips = response.data.filter(clip => clip.video_id === videoId)
      allClips.push(...vodClips)

      cursor = response.pagination.cursor
    } while (cursor)

    return allClips
  }
}

// Parse Twitch duration string to seconds
export function parseTwitchDuration(duration: string): number {
  const regex = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/
  const match = duration.match(regex)
  
  if (!match) return 0
  
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  
  return hours * 3600 + minutes * 60 + seconds
}

// Format seconds to Twitch duration string
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  
  let result = ''
  if (h > 0) result += `${h}h`
  if (m > 0) result += `${m}m`
  if (s > 0 || result === '') result += `${s}s`
  
  return result
}
