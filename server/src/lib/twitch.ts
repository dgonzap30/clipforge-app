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
  async getUserByLogin(login: string): Promise<TwitchUser | null> {
    const data = await this.request<{ data: TwitchUser[] }>(`/users?login=${login}`)
    return data.data[0] || null
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
  } = {}): Promise<{ data: any[]; pagination: { cursor?: string } }> {
    const params = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: String(options.first || 20),
    })
    
    if (options.started_at) params.set('started_at', options.started_at)
    if (options.ended_at) params.set('ended_at', options.ended_at)
    
    return this.request(`/clips?${params}`)
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
