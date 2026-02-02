import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Clip } from '@/lib/api'

/**
 * Query key factory for clips
 */
export const clipsKeys = {
  all: ['clips'] as const,
  lists: () => [...clipsKeys.all, 'list'] as const,
  list: (filters?: { status?: Clip['status']; limit?: number; offset?: number }) =>
    [...clipsKeys.lists(), filters] as const,
  details: () => [...clipsKeys.all, 'detail'] as const,
  detail: (id: string) => [...clipsKeys.details(), id] as const,
}

/**
 * Hook to fetch a list of clips with optional filters
 */
export function useClips(options?: {
  status?: Clip['status']
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: clipsKeys.list(options),
    queryFn: () => api.clips.list(options),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to fetch a single clip by ID
 */
export function useClip(id: string | null) {
  return useQuery({
    queryKey: clipsKeys.detail(id!),
    queryFn: () => api.clips.get(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to delete a clip
 */
export function useDeleteClip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.clips.delete(id),
    onSuccess: (_data, id) => {
      // Invalidate and refetch all clips lists
      queryClient.invalidateQueries({ queryKey: clipsKeys.lists() })

      // Remove the specific clip from cache
      queryClient.removeQueries({ queryKey: clipsKeys.detail(id) })
    },
  })
}

/**
 * Hook to bulk delete clips
 */
export function useBulkDeleteClips() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => api.clips.bulkDelete(ids),
    onSuccess: (_data, ids) => {
      // Invalidate and refetch all clips lists
      queryClient.invalidateQueries({ queryKey: clipsKeys.lists() })

      // Remove all deleted clips from cache
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: clipsKeys.detail(id) })
      })
    },
  })
}

/**
 * Hook to update a clip
 */
export function useUpdateClip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Clip, 'title' | 'status'>> }) =>
      api.clips.update(id, data),
    onSuccess: (updatedClip) => {
      // Update the specific clip in cache
      queryClient.setQueryData(clipsKeys.detail(updatedClip.id), updatedClip)

      // Invalidate lists to reflect changes
      queryClient.invalidateQueries({ queryKey: clipsKeys.lists() })
    },
  })
}

/**
 * Hook to bulk export clips
 */
export function useBulkExportClips() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ids,
      platform,
    }: {
      ids: string[]
      platform: 'tiktok' | 'youtube' | 'instagram'
    }) => api.clips.bulkExport(ids, platform),
    onSuccess: () => {
      // Invalidate clips lists to reflect export status changes
      queryClient.invalidateQueries({ queryKey: clipsKeys.lists() })
    },
  })
}
