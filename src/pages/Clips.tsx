import { Filter, Grid, List, Download, Trash2, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useClips } from '@/hooks'
import { Clip } from '@/lib/api'
import { ClipPlayerModal } from '@/components/clips/ClipPlayerModal'

const ITEMS_PER_PAGE = 20

export function Clips() {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [statusFilter, setStatusFilter] = useState<Clip['status'] | 'all'>('all')
  const [page, setPage] = useState(0)
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const { clips, total, hasMore, loading, error, deleteClip } = useClips({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
  })

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  const handleDelete = async (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this clip?')) return

    try {
      await deleteClip(clipId)
    } catch (err) {
      console.error('Failed to delete clip:', err)
      alert('Failed to delete clip')
    }
  }

  const handleDownload = async (clip: Clip, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!clip.videoUrl) {
      alert('Video URL not available')
      return
    }

    try {
      const response = await fetch(clip.videoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.title.replace(/[^a-z0-9]/gi, '_')}.mp4`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download clip:', err)
      alert('Failed to download clip')
    }
  }

  const handleClipClick = (clip: Clip) => {
    setSelectedClip(clip)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clips</h1>
          <p className="text-dark-400 mt-1">
            {loading ? 'Loading...' : `${total} clip${total !== 1 ? 's' : ''} total`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={cn(
                'btn-secondary',
                statusFilter !== 'all' && 'bg-forge-500/20 text-forge-400'
              )}
            >
              <Filter className="w-4 h-4" />
              {statusFilter !== 'all' ? statusFilter : 'Filter'}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-800 rounded-lg shadow-xl border border-dark-700 py-1 z-10">
                {(['all', 'ready', 'processing', 'exported', 'failed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status)
                      setShowFilterMenu(false)
                      setPage(0)
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left hover:bg-dark-700 transition-colors',
                      statusFilter === status && 'bg-dark-700 text-forge-400'
                    )}
                  >
                    {status === 'all' ? 'All Clips' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex bg-dark-800 rounded-lg p-1">
            <button
              onClick={() => setView('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'grid' ? 'bg-dark-700 text-white' : 'text-dark-400'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'list' ? 'bg-dark-700 text-white' : 'text-dark-400'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card p-4 bg-red-500/10 border-red-500/20">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && clips.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forge-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && clips.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-dark-400 text-lg">No clips found</p>
          <p className="text-dark-500 mt-2">
            {statusFilter !== 'all'
              ? `No clips with status "${statusFilter}"`
              : 'Start processing a VOD to generate clips'}
          </p>
        </div>
      )}

      {/* Clips grid/list */}
      {clips.length > 0 && (
        <div className={cn(
          view === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
        )}>
          {clips.map((clip) => (
            <div
              key={clip.id}
              onClick={() => handleClipClick(clip)}
              className="card overflow-hidden group cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="aspect-[9/16] bg-dark-800 relative">
                {clip.thumbnailUrl ? (
                  <img
                    src={clip.thumbnailUrl}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-dark-600">
                    {clip.status === 'processing' ? (
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-500 mx-auto mb-2" />
                        <div className="text-sm">Processing...</div>
                      </div>
                    ) : (
                      <span>No thumbnail</span>
                    )}
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {clip.status === 'ready' && clip.videoUrl && (
                    <button
                      onClick={(e) => handleDownload(clip, e)}
                      className="btn-primary p-2"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(clip.id, e)}
                    className="btn-ghost p-2 text-red-400 hover:text-red-300 bg-dark-900/80"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-mono">
                  {formatDuration(clip.duration)}
                </div>

                {/* Status badge */}
                <div className={cn(
                  'absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium',
                  clip.status === 'ready' && 'bg-green-500/80 text-white',
                  clip.status === 'processing' && 'bg-yellow-500/80 text-black',
                  clip.status === 'failed' && 'bg-red-500/80 text-white',
                  clip.status === 'exported' && 'bg-blue-500/80 text-white'
                )}>
                  {clip.status}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-medium truncate">{clip.title}</h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-dark-400">
                    Score: {(clip.hydeScore * 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-dark-500">
                    {new Date(clip.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-dark-400">
            Page {page + 1} of {totalPages}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={!hasMore}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Clip Player Modal */}
      <ClipPlayerModal
        clip={selectedClip}
        isOpen={!!selectedClip}
        onClose={() => setSelectedClip(null)}
        onDownload={handleDownload}
      />
    </div>
  )
}
