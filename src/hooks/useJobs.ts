import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ProcessingJob, JobStatus } from '@/lib/api'

interface UseJobsOptions {
  status?: JobStatus
  pollInterval?: number // ms, 0 to disable
}

const JOBS_QUERY_KEY = 'jobs'

export function useJobs(options: UseJobsOptions = {}) {
  const { status, pollInterval = 5000 } = options
  const queryClient = useQueryClient()

  // Fetch jobs with TanStack Query
  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [JOBS_QUERY_KEY, status],
    queryFn: async () => {
      const { jobs } = await api.jobs.list(status)
      return jobs
    },
    refetchInterval: (query) => {
      const jobs = query.state.data
      if (!jobs || pollInterval === 0) return false

      // Only poll if there are active (non-terminal) jobs
      const hasActiveJobs = jobs.some(
        j => !['completed', 'failed'].includes(j.status)
      )
      return hasActiveJobs ? pollInterval : false
    },
  })

  const jobs = data ?? []
  const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to fetch jobs' : null

  // Mutations with optimistic updates
  const createJobMutation = useMutation({
    mutationFn: async (data: Parameters<typeof api.jobs.create>[0]) => {
      return await api.jobs.create(data)
    },
    onSuccess: (newJob) => {
      queryClient.setQueryData<ProcessingJob[]>([JOBS_QUERY_KEY, status], (old) =>
        old ? [newJob, ...old] : [newJob]
      )
    },
  })

  const cancelJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.jobs.cancel(id)
    },
    onSuccess: (updatedJob) => {
      queryClient.setQueryData<ProcessingJob[]>([JOBS_QUERY_KEY, status], (old) =>
        old ? old.map(j => j.id === updatedJob.id ? updatedJob : j) : [updatedJob]
      )
    },
  })

  const retryJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return await api.jobs.retry(id)
    },
    onSuccess: (updatedJob) => {
      queryClient.setQueryData<ProcessingJob[]>([JOBS_QUERY_KEY, status], (old) =>
        old ? old.map(j => j.id === updatedJob.id ? updatedJob : j) : [updatedJob]
      )
    },
  })

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.jobs.delete(id)
      return id
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<ProcessingJob[]>([JOBS_QUERY_KEY, status], (old) =>
        old ? old.filter(j => j.id !== deletedId) : []
      )
    },
  })

  return {
    jobs,
    loading,
    error,
    refresh: refetch,
    createJob: createJobMutation.mutateAsync,
    cancelJob: cancelJobMutation.mutateAsync,
    retryJob: retryJobMutation.mutateAsync,
    deleteJob: deleteJobMutation.mutateAsync,
  }
}

/**
 * Hook for watching a single job's progress
 */
export function useJobProgress(jobId: string | null, pollInterval = 2000) {
  const {
    data: job,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null
      return await api.jobs.get(jobId)
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data
      if (!job || !jobId) return false

      // Stop polling once job reaches a terminal state
      const isTerminal = ['completed', 'failed'].includes(job.status)
      return isTerminal ? false : pollInterval
    },
  })

  const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to fetch job' : null

  return { job: job ?? null, loading, error }
}
