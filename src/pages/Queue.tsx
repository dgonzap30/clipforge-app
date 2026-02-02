import { useState } from 'react'
import { Plus, Play, Pause, X, ExternalLink, RefreshCw, Trash2, AlertCircle } from 'lucide-react'
import { useJobs } from '@/hooks/useJobs'
import { VodBrowserModal } from '@/components/queue/VodBrowserModal'
import { VOD } from '@/lib/api'

export function Queue() {
  const { jobs, loading, error, createJob, cancelJob, retryJob, deleteJob } = useJobs()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleSelectVod = async (vod: VOD) => {
    try {
      setActionError(null)
      await createJob({
        vodId: vod.id,
        vodUrl: vod.url,
        title: vod.title,
        channelLogin: vod.streamId || 'unknown',
        duration: vod.duration,
      })
    } catch (err) {
      console.error('Failed to create job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to create job')
    }
  }

  const handleCancel = async (id: string) => {
    try {
      setActionLoading(id)
      setActionError(null)
      await cancelJob(id)
    } catch (err) {
      console.error('Failed to cancel job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to cancel job')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async (id: string) => {
    try {
      setActionLoading(id)
      setActionError(null)
      await retryJob(id)
    } catch (err) {
      console.error('Failed to retry job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to retry job')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(id)
      setActionError(null)
      await deleteJob(id)
    } catch (err) {
      console.error('Failed to delete job:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to delete job')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, string> = {
      queued: 'Queued',
      downloading: 'Downloading',
      analyzing: 'Analyzing',
      extracting: 'Extracting Clips',
      reframing: 'Reframing',
      captioning: 'Adding Captions',
      completed: 'Completed',
      failed: 'Failed',
    }
    return statusMap[status] || status
  }

  const isProcessing = (status: string) => {
    return ['downloading', 'analyzing', 'extracting', 'reframing', 'captioning'].includes(status)
  }

  const isTerminal = (status: string) => {
    return ['completed', 'failed'].includes(status)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Processing Queue</h1>
          <p className="text-dark-400 mt-1">Streams being analyzed for clips</p>
        </div>

        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Add Stream
        </button>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 hover:bg-red-500/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Loading Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Queue list */}
      {loading && jobs.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-dark-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <RefreshCw className="w-8 h-8 text-dark-500" />
          </div>
          <p className="text-dark-400">Loading queue...</p>
        </div>
      ) : jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="card p-4">
              <div className="flex items-center gap-4">
                {/* Thumbnail placeholder */}
                <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
                  Thumbnail
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{job.title}</h3>
                    <a
                      href={job.vodUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dark-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-sm text-dark-400 mt-1">
                    {job.channelLogin} • {Math.floor(job.duration / 3600)}:{String(Math.floor((job.duration % 3600) / 60)).padStart(2, '0')}:{String(job.duration % 60).padStart(2, '0')}
                  </p>

                  {/* Progress bar for processing jobs */}
                  {isProcessing(job.status) && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-forge-400">{getStatusDisplay(job.status)}</span>
                        <span className="text-dark-400">{Math.round(job.progress)}%</span>
                      </div>
                      <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-forge-500 transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      {job.clipsFound > 0 && (
                        <p className="text-xs text-dark-500 mt-1">
                          {job.clipsFound} potential clips found
                        </p>
                      )}
                    </div>
                  )}

                  {/* Queued status */}
                  {job.status === 'queued' && (
                    <p className="text-sm text-dark-500 mt-2">Waiting in queue...</p>
                  )}

                  {/* Completed status */}
                  {job.status === 'completed' && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400">
                        Completed
                      </div>
                      <p className="text-xs text-dark-500">
                        {job.clipsFound} clips generated
                      </p>
                    </div>
                  )}

                  {/* Failed status */}
                  {job.status === 'failed' && (
                    <div className="mt-2">
                      <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 inline-block">
                        Failed
                      </div>
                      {job.error && (
                        <p className="text-xs text-red-400 mt-1">{job.error}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Pause/Resume button - only for processing jobs */}
                  {isProcessing(job.status) && (
                    <button
                      className="btn-secondary p-2"
                      onClick={() => handleCancel(job.id)}
                      disabled={actionLoading === job.id}
                      title="Cancel job"
                    >
                      {actionLoading === job.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Retry button - only for failed jobs */}
                  {job.status === 'failed' && (
                    <button
                      className="btn-secondary p-2"
                      onClick={() => handleRetry(job.id)}
                      disabled={actionLoading === job.id}
                      title="Retry job"
                    >
                      {actionLoading === job.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    className="btn-ghost p-2 text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(job.id)}
                    disabled={actionLoading === job.id}
                    title="Delete job"
                  >
                    {actionLoading === job.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-dark-800 rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-dark-500" />
          </div>
          <h3 className="text-lg font-medium">No streams in queue</h3>
          <p className="text-dark-400 mt-1">Add a Twitch VOD to start generating clips</p>
          <button
            className="btn-primary mt-4"
            onClick={() => setIsModalOpen(true)}
          >
            Add Your First Stream
          </button>
        </div>
      )}

      {/* VOD Browser Modal */}
      <VodBrowserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectVod={handleSelectVod}
      />
    </div>
  )
}
