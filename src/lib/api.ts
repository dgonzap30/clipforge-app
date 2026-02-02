/**
 * API Client
 *
 * Connects frontend to ClipForge backend
 */

import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  // Get the access token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add Authorization header if session exists
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  // Merge with any additional headers from options
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value
      }
    })
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new APIError(
      error.error || error.message || 'Request failed',
      response.status,
      error
    )
  }

  return response.json()
}

// VODs API
export interface VOD {
  id: string
  title: string
  duration: number
  durationFormatted: string
  thumbnailUrl: string
  url: string
  viewCount: number
  createdAt: string
  streamId: string | null
}

export const vods = {
  getMine: () => request<{
    vods: VOD[]
    pagination: { cursor?: string }
    user: { id: string; login: string; displayName: string }
  }>('/api/vods/mine'),
  
  getByChannel: (login: string) => request<{
    vods: VOD[]
    pagination: { cursor?: string }
    channel: {
      id: string
      login: string
      displayName: string
      profileImageUrl: string
    }
  }>(`/api/vods/channel/${login}`),
  
  getById: (id: string) => request<VOD & {
    description: string
    mutedSegments: Array<{ duration: number; offset: number }> | null
    channel: { id: string; login: string; displayName: string }
  }>(`/api/vods/${id}`),
  
  getClips: (login: string) => request<{
    clips: unknown[]
    pagination: { cursor?: string }
  }>(`/api/vods/channel/${login}/clips`),
}

// Jobs API
export type JobStatus = 
  | 'queued'
  | 'downloading'
  | 'analyzing'
  | 'extracting'
  | 'reframing'
  | 'captioning'
  | 'completed'
  | 'failed'

export interface ProcessingJob {
  id: string
  vodId: string
  vodUrl: string
  title: string
  channelLogin: string
  duration: number
  status: JobStatus
  progress: number
  currentStep: string
  clipsFound: number
  clipIds: string[]
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  settings: {
    minDuration: number
    maxDuration: number
    sensitivity: 'low' | 'medium' | 'high'
    chatAnalysis: boolean
    audioPeaks: boolean
    faceReactions: boolean
    autoCaptions: boolean
    outputFormat: 'vertical' | 'square' | 'horizontal'
  }
}

export const jobs = {
  list: (status?: JobStatus) => request<{ jobs: ProcessingJob[] }>(
    `/api/jobs${status ? `?status=${status}` : ''}`
  ),
  
  get: (id: string) => request<ProcessingJob>(`/api/jobs/${id}`),
  
  create: (data: {
    vodId: string
    vodUrl: string
    title: string
    channelLogin: string
    duration: number
    settings?: Partial<ProcessingJob['settings']>
  }) => request<ProcessingJob>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  cancel: (id: string) => request<ProcessingJob>(`/api/jobs/${id}/cancel`, {
    method: 'POST',
  }),
  
  retry: (id: string) => request<ProcessingJob>(`/api/jobs/${id}/retry`, {
    method: 'POST',
  }),
  
  delete: (id: string) => request<{ success: boolean }>(`/api/jobs/${id}`, {
    method: 'DELETE',
  }),
}

// Clips API
export interface Clip {
  id: string
  jobId: string
  vodId: string
  title: string
  startTime: number
  endTime: number
  duration: number
  status: 'processing' | 'ready' | 'exported' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  hydeScore: number
  signals: {
    chatVelocity?: number
    audioPeak?: number
    faceReaction?: number
    viewerClips?: number
  }
  createdAt: string
  updatedAt: string
}

export const clips = {
  list: (options?: { status?: Clip['status']; limit?: number; offset?: number }) => {
    const params = new URLSearchParams()
    if (options?.status) params.set('status', options.status)
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    
    return request<{ clips: Clip[]; total: number; hasMore: boolean }>(
      `/api/clips${params.toString() ? `?${params}` : ''}`
    )
  },
  
  get: (id: string) => request<Clip>(`/api/clips/${id}`),
  
  update: (id: string, data: Partial<Pick<Clip, 'title' | 'status'>>) => 
    request<Clip>(`/api/clips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) => request<{ success: boolean }>(`/api/clips/${id}`, {
    method: 'DELETE',
  }),
  
  bulkDelete: (ids: string[]) => request<{ deleted: number }>('/api/clips/bulk/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  }),
  
  bulkExport: (ids: string[], platform: 'tiktok' | 'youtube' | 'instagram') => 
    request<{ exported: string[] }>('/api/clips/bulk/export', {
      method: 'POST',
      body: JSON.stringify({ ids, platform }),
    }),
}

// Health check
export const health = () => request<{ status: string }>('/health')

// Export all
export const api = {
  vods,
  jobs,
  clips,
  health,
}

export default api
