import { env } from './env'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com'
const TIKTOK_AUTH_BASE = 'https://www.tiktok.com/v2/auth'

// Types
export interface TikTokTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
  open_id: string
}

export interface TikTokUserInfo {
  open_id: string
  union_id: string
  avatar_url?: string
  display_name?: string
}

export interface TikTokUploadResponse {
  data: {
    publish_id: string
    upload_url: string
  }
  error?: {
    code: string
    message: string
  }
}

export interface TikTokPublishStatus {
  status: 'PUBLISH_COMPLETE' | 'PROCESSING_UPLOAD' | 'FAILED' | 'PROCESSING_PUBLISH'
  fail_reason?: string
}

// OAuth URLs
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY,
    redirect_uri: env.TIKTOK_REDIRECT_URI,
    response_type: 'code',
    scope: 'video.upload,video.publish',
    state,
  })

  return `${TIKTOK_AUTH_BASE}/authorize/?${params}`
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code: string): Promise<TikTokTokenResponse> {
  const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.TIKTOK_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`TikTok token exchange failed: ${error}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`TikTok token exchange error: ${data.error.message}`)
  }

  return data.data
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<TikTokTokenResponse> {
  const response = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`TikTok token refresh failed: ${error}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`TikTok token refresh error: ${data.error.message}`)
  }

  return data.data
}

// Validate token
export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${TIKTOK_API_BASE}/v2/user/info/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    return response.ok
  } catch {
    return false
  }
}

// TikTok API client class
export class TikTokClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${TIKTOK_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TikTok API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(`TikTok API error: ${data.error.message}`)
    }

    return data
  }

  // Get user info
  async getUserInfo(): Promise<TikTokUserInfo> {
    const data = await this.request<{ data: { user: TikTokUserInfo } }>('/v2/user/info/')
    return data.data.user
  }

  // Upload video to TikTok (Direct Post API - 2-step process)
  async uploadVideo(options: {
    videoPath: string
    title?: string
    privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
    disableComment?: boolean
    disableDuet?: boolean
    disableStitch?: boolean
    videoDescription?: string
  }): Promise<string> {
    const {
      videoPath,
      title = '',
      privacyLevel = 'PUBLIC_TO_EVERYONE',
      disableComment = false,
      disableDuet = false,
      disableStitch = false,
    } = options

    // Step 1: Initialize upload and get upload URL
    const initResponse = await this.request<TikTokUploadResponse>('/v2/post/publish/video/init/', {
      method: 'POST',
      body: JSON.stringify({
        post_info: {
          title,
          privacy_level: privacyLevel,
          disable_comment: disableComment,
          disable_duet: disableDuet,
          disable_stitch: disableStitch,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: await this.getFileSize(videoPath),
          chunk_size: 5 * 1024 * 1024, // 5MB chunks
          total_chunk_count: 1,
        },
      }),
    })

    const { publish_id, upload_url } = initResponse.data

    // Step 2: Upload video file to the upload URL
    const videoBlob = await this.readVideoFile(videoPath)

    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBlob.size),
      },
      body: videoBlob,
    })

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload video: ${uploadResponse.statusText}`)
    }

    // Step 3: Confirm publish
    await this.request('/v2/post/publish/status/fetch/', {
      method: 'POST',
      body: JSON.stringify({
        publish_id,
      }),
    })

    return publish_id
  }

  // Check publish status
  async getPublishStatus(publishId: string): Promise<TikTokPublishStatus> {
    const data = await this.request<{ data: TikTokPublishStatus }>('/v2/post/publish/status/fetch/', {
      method: 'POST',
      body: JSON.stringify({
        publish_id: publishId,
      }),
    })

    return data.data
  }

  // Helper: Get file size
  private async getFileSize(filePath: string): Promise<number> {
    const fs = await import('fs/promises')
    const stats = await fs.stat(filePath)
    return stats.size
  }

  // Helper: Read video file as Blob
  private async readVideoFile(filePath: string): Promise<Blob> {
    const fs = await import('fs/promises')
    const buffer = await fs.readFile(filePath)
    return new Blob([buffer], { type: 'video/mp4' })
  }
}
