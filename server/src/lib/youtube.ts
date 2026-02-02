import { env } from './env'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3'
const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Types
export interface YouTubeTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export interface YouTubeVideo {
  id: string
  snippet: {
    title: string
    description: string
    tags?: string[]
    categoryId: string
  }
  status: {
    privacyStatus: 'public' | 'private' | 'unlisted'
    publishAt?: string
  }
}

export interface YouTubeUploadOptions {
  title: string
  description: string
  tags?: string[]
  categoryId?: string
  privacyStatus?: 'public' | 'private' | 'unlisted'
  publishAt?: string
}

// OAuth URLs
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID,
    redirect_uri: env.YOUTUBE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_AUTH_BASE}/auth?${params}`
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.YOUTUBE_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<YouTubeTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID,
      client_secret: env.YOUTUBE_CLIENT_SECRET,
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

// API client class
export class YouTubeClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${YOUTUBE_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()

      // Check for quota exceeded error
      if (response.status === 403 && error.includes('quotaExceeded')) {
        throw new Error('YouTube API quota exceeded. Daily limit: 10,000 units. Video upload costs 1,600 units.')
      }

      throw new Error(`YouTube API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Upload video to YouTube
  async uploadVideo(videoPath: string, options: YouTubeUploadOptions): Promise<YouTubeVideo> {
    // Prepare metadata
    const metadata = {
      snippet: {
        title: options.title,
        description: options.description,
        tags: options.tags || ['#Shorts'],
        categoryId: options.categoryId || '20', // Gaming category
      },
      status: {
        privacyStatus: options.privacyStatus || 'public',
        ...(options.publishAt && { publishAt: options.publishAt }),
      },
    }

    // Read video file
    const file = Bun.file(videoPath)
    const videoBuffer = await file.arrayBuffer()

    // Create multipart upload
    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: video/mp4\r\n\r\n'

    // Combine metadata and video
    const encoder = new TextEncoder()
    const metadataBytes = encoder.encode(metadataPart)
    const closingBytes = encoder.encode(closeDelimiter)

    const combinedBuffer = new Uint8Array(
      metadataBytes.length + videoBuffer.byteLength + closingBytes.length
    )

    combinedBuffer.set(metadataBytes, 0)
    combinedBuffer.set(new Uint8Array(videoBuffer), metadataBytes.length)
    combinedBuffer.set(closingBytes, metadataBytes.length + videoBuffer.byteLength)

    // Upload
    const response = await fetch(`${YOUTUBE_UPLOAD_BASE}/videos?uploadType=multipart&part=snippet,status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(combinedBuffer.length),
      },
      body: combinedBuffer,
    })

    if (!response.ok) {
      const error = await response.text()

      // Check for quota exceeded error
      if (response.status === 403 && error.includes('quotaExceeded')) {
        throw new Error('YouTube API quota exceeded. Daily limit: 10,000 units. Video upload costs 1,600 units.')
      }

      throw new Error(`YouTube upload failed: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Get channel info
  async getChannel(): Promise<{ items: unknown[] }> {
    return this.request('/channels?part=snippet,contentDetails,statistics&mine=true')
  }

  // Get video by ID
  async getVideo(videoId: string): Promise<YouTubeVideo | null> {
    const data = await this.request<{ items: YouTubeVideo[] }>(`/videos?part=snippet,status&id=${videoId}`)
    return data.items[0] || null
  }
}
