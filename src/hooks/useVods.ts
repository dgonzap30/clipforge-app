import { useEffect, useState, useCallback } from 'react'
import { api, VOD } from '@/lib/api'

interface UserVodsResponse {
  vods: VOD[]
  pagination: { cursor?: string }
  user: { id: string; login: string; displayName: string }
}

interface ChannelVodsResponse {
  vods: VOD[]
  pagination: { cursor?: string }
  channel: {
    id: string
    login: string
    displayName: string
    profileImageUrl: string
  }
}

interface VodDetailsResponse extends VOD {
  description: string
  mutedSegments: Array<{ duration: number; offset: number }> | null
  channel: { id: string; login: string; displayName: string }
}

/**
 * Hook for fetching the authenticated user's VODs
 */
export function useUserVods() {
  const [data, setData] = useState<UserVodsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVods = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.vods.getMine()
      setData(response)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch user VODs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch VODs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVods()
  }, [fetchVods])

  return {
    vods: data?.vods ?? [],
    user: data?.user ?? null,
    pagination: data?.pagination ?? null,
    loading,
    error,
    refresh: fetchVods,
  }
}

/**
 * Hook for fetching VODs from a specific channel
 */
export function useChannelVods(channelLogin: string | null) {
  const [data, setData] = useState<ChannelVodsResponse | null>(null)
  const [loading, setLoading] = useState(!!channelLogin)
  const [error, setError] = useState<string | null>(null)

  const fetchVods = useCallback(async () => {
    if (!channelLogin) {
      setData(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await api.vods.getByChannel(channelLogin)
      setData(response)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch channel VODs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch VODs')
    } finally {
      setLoading(false)
    }
  }, [channelLogin])

  useEffect(() => {
    fetchVods()
  }, [fetchVods])

  return {
    vods: data?.vods ?? [],
    channel: data?.channel ?? null,
    pagination: data?.pagination ?? null,
    loading,
    error,
    refresh: fetchVods,
  }
}

/**
 * Hook for fetching a single VOD's details
 */
export function useVodDetails(vodId: string | null) {
  const [vod, setVod] = useState<VodDetailsResponse | null>(null)
  const [loading, setLoading] = useState(!!vodId)
  const [error, setError] = useState<string | null>(null)

  const fetchVod = useCallback(async () => {
    if (!vodId) {
      setVod(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await api.vods.getById(vodId)
      setVod(response)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch VOD details:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch VOD')
    } finally {
      setLoading(false)
    }
  }, [vodId])

  useEffect(() => {
    fetchVod()
  }, [fetchVod])

  return {
    vod,
    loading,
    error,
    refresh: fetchVod,
  }
}

/**
 * Hook for fetching Twitch clips from a channel
 */
export function useChannelClips(channelLogin: string | null) {
  const [clips, setClips] = useState<unknown[]>([])
  const [pagination, setPagination] = useState<{ cursor?: string } | null>(null)
  const [loading, setLoading] = useState(!!channelLogin)
  const [error, setError] = useState<string | null>(null)

  const fetchClips = useCallback(async () => {
    if (!channelLogin) {
      setClips([])
      setPagination(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await api.vods.getClips(channelLogin)
      setClips(response.clips)
      setPagination(response.pagination)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch channel clips:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch clips')
    } finally {
      setLoading(false)
    }
  }, [channelLogin])

  useEffect(() => {
    fetchClips()
  }, [fetchClips])

  return {
    clips,
    pagination,
    loading,
    error,
    refresh: fetchClips,
  }
}
