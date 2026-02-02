import { env } from './env'

const FACEBOOK_OAUTH_BASE = 'https://www.facebook.com/v18.0/dialog/oauth'
const FACEBOOK_GRAPH_BASE = 'https://graph.facebook.com/v18.0'
const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com/v18.0'

// Types
export interface InstagramUser {
  id: string
  username: string
  account_type: string
  media_count?: number
}

export interface InstagramMediaContainer {
  id: string
  status?: string
  status_code?: string
}

export interface InstagramMedia {
  id: string
  media_type: string
  media_url: string
  permalink: string
  caption?: string
  timestamp: string
}

export interface FacebookTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface LongLivedTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface FacebookPage {
  id: string
  name: string
  instagram_business_account?: {
    id: string
  }
}

export interface InstagramBusinessAccount {
  id: string
  username: string
}

// OAuth URLs
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    response_type: 'code',
    scope: 'instagram_basic,instagram_content_publish,pages_read_engagement',
    state,
  })

  return `${FACEBOOK_OAUTH_BASE}?${params}`
}

// Exchange code for short-lived access token
export async function exchangeCodeForTokens(code: string): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID,
    client_secret: env.INSTAGRAM_APP_SECRET,
    code,
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
  })

  const response = await fetch(`${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

// Exchange short-lived token for long-lived token (60 days)
export async function getLongLivedToken(shortLivedToken: string): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.INSTAGRAM_APP_ID,
    client_secret: env.INSTAGRAM_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  })

  const response = await fetch(`${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Long-lived token exchange failed: ${error}`)
  }

  return response.json()
}

// Refresh long-lived token (before expiry)
export async function refreshLongLivedToken(currentToken: string): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.INSTAGRAM_APP_ID,
    client_secret: env.INSTAGRAM_APP_SECRET,
    fb_exchange_token: currentToken,
  })

  const response = await fetch(`${FACEBOOK_GRAPH_BASE}/oauth/access_token?${params}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  return response.json()
}

// Validate token and get metadata
export async function validateToken(accessToken: string): Promise<{
  valid: boolean
  user_id?: string
  expires_at?: number
}> {
  const params = new URLSearchParams({
    input_token: accessToken,
    access_token: `${env.INSTAGRAM_APP_ID}|${env.INSTAGRAM_APP_SECRET}`,
  })

  const response = await fetch(`${FACEBOOK_GRAPH_BASE}/debug_token?${params}`)

  if (!response.ok) {
    return { valid: false }
  }

  const result = await response.json()
  return {
    valid: result.data?.is_valid || false,
    user_id: result.data?.user_id,
    expires_at: result.data?.expires_at,
  }
}

// Get Instagram Business Account from Facebook Pages
export async function getInstagramBusinessAccount(accessToken: string): Promise<InstagramBusinessAccount | null> {
  const response = await fetch(
    `${FACEBOOK_GRAPH_BASE}/me/accounts?fields=instagram_business_account,name&access_token=${accessToken}`
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Facebook pages: ${error}`)
  }

  const result = await response.json()
  const pages: FacebookPage[] = result.data || []

  // Find first page with Instagram Business Account
  const pageWithInstagram = pages.find(page => page.instagram_business_account)

  if (!pageWithInstagram?.instagram_business_account) {
    return null
  }

  // Get Instagram account details
  const igAccountId = pageWithInstagram.instagram_business_account.id
  const igResponse = await fetch(
    `${FACEBOOK_GRAPH_BASE}/${igAccountId}?fields=id,username&access_token=${accessToken}`
  )

  if (!igResponse.ok) {
    const error = await igResponse.text()
    throw new Error(`Failed to get Instagram account details: ${error}`)
  }

  return igResponse.json()
}

// API client class
export class InstagramClient {
  private accessToken: string
  private igUserId: string

  constructor(accessToken: string, igUserId: string) {
    this.accessToken = accessToken
    this.igUserId = igUserId
  }

  private async request<T>(
    baseUrl: string,
    endpoint: string,
    options: RequestInit & { params?: Record<string, string> } = {}
  ): Promise<T> {
    const { params = {}, ...fetchOptions } = options
    const urlParams = new URLSearchParams({
      access_token: this.accessToken,
      ...params,
    })

    const url = `${baseUrl}${endpoint}?${urlParams}`

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Instagram API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // Get current Instagram user
  async getUser(): Promise<InstagramUser> {
    return this.request<InstagramUser>(
      INSTAGRAM_GRAPH_BASE,
      `/${this.igUserId}`,
      {
        params: {
          fields: 'id,username,account_type,media_count',
        },
      }
    )
  }

  // Create media container for Reels (step 1 of upload)
  async createMediaContainer(options: {
    videoUrl: string
    caption?: string
    shareToFeed?: boolean
    thumbOffset?: number
  }): Promise<InstagramMediaContainer> {
    const params: Record<string, string> = {
      media_type: 'REELS',
      video_url: options.videoUrl,
    }

    if (options.caption) {
      params.caption = options.caption
    }

    if (options.shareToFeed !== undefined) {
      params.share_to_feed = options.shareToFeed.toString()
    }

    if (options.thumbOffset !== undefined) {
      params.thumb_offset = options.thumbOffset.toString()
    }

    return this.request<InstagramMediaContainer>(
      INSTAGRAM_GRAPH_BASE,
      `/${this.igUserId}/media`,
      {
        method: 'POST',
        params,
      }
    )
  }

  // Check media container status
  async getMediaContainerStatus(containerId: string): Promise<{
    status: string
    status_code: string
  }> {
    return this.request<{ status: string; status_code: string }>(
      INSTAGRAM_GRAPH_BASE,
      `/${containerId}`,
      {
        params: {
          fields: 'status,status_code',
        },
      }
    )
  }

  // Publish media container (step 2 of upload)
  async publishMedia(containerId: string): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      INSTAGRAM_GRAPH_BASE,
      `/${this.igUserId}/media_publish`,
      {
        method: 'POST',
        params: {
          creation_id: containerId,
        },
      }
    )
  }

  // Get media details
  async getMedia(mediaId: string): Promise<InstagramMedia> {
    return this.request<InstagramMedia>(
      INSTAGRAM_GRAPH_BASE,
      `/${mediaId}`,
      {
        params: {
          fields: 'id,media_type,media_url,permalink,caption,timestamp',
        },
      }
    )
  }

  // Get user's media
  async getUserMedia(options: {
    limit?: number
    after?: string
  } = {}): Promise<{ data: InstagramMedia[]; paging?: { cursors?: { after?: string } } }> {
    const params: Record<string, string> = {
      fields: 'id,media_type,media_url,permalink,caption,timestamp',
    }

    if (options.limit) {
      params.limit = options.limit.toString()
    }

    if (options.after) {
      params.after = options.after
    }

    return this.request<{ data: InstagramMedia[]; paging?: { cursors?: { after?: string } } }>(
      INSTAGRAM_GRAPH_BASE,
      `/${this.igUserId}/media`,
      { params }
    )
  }

  // Upload Reels - complete flow with polling
  async uploadReels(options: {
    videoUrl: string
    caption?: string
    shareToFeed?: boolean
    thumbOffset?: number
    pollInterval?: number
    maxAttempts?: number
  }): Promise<{ mediaId: string; permalink: string }> {
    const pollInterval = options.pollInterval || 5000 // 5 seconds
    const maxAttempts = options.maxAttempts || 60 // 5 minutes max

    // Step 1: Create media container
    const container = await this.createMediaContainer({
      videoUrl: options.videoUrl,
      caption: options.caption,
      shareToFeed: options.shareToFeed,
      thumbOffset: options.thumbOffset,
    })

    // Step 2: Poll for container status
    let attempts = 0
    let status = ''

    while (attempts < maxAttempts) {
      const statusData = await this.getMediaContainerStatus(container.id)
      status = statusData.status_code

      if (status === 'FINISHED') {
        break
      } else if (status === 'ERROR') {
        throw new Error('Media container processing failed')
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      attempts++
    }

    if (status !== 'FINISHED') {
      throw new Error('Media container processing timeout')
    }

    // Step 3: Publish media
    const publishResult = await this.publishMedia(container.id)

    // Step 4: Get media details including permalink
    const media = await this.getMedia(publishResult.id)

    return {
      mediaId: publishResult.id,
      permalink: media.permalink,
    }
  }
}
