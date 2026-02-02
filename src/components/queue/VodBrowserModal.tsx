import { useState, useEffect } from 'react'
import { X, Search, Loader2, ExternalLink } from 'lucide-react'
import { api, VOD } from '@/lib/api'

interface VodBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectVod: (vod: VOD) => void
}

export function VodBrowserModal({ isOpen, onClose, onSelectVod }: VodBrowserModalProps) {
  const [channelSearch, setChannelSearch] = useState('')
  const [vods, setVods] = useState<VOD[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setChannelSearch('')
      setVods([])
      setError(null)
      setSelectedChannel(null)
    }
  }, [isOpen])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!channelSearch.trim()) return

    setLoading(true)
    setError(null)
    setSelectedChannel(channelSearch.trim())

    try {
      const { vods: fetchedVods } = await api.vods.getByChannel(channelSearch.trim())
      setVods(fetchedVods)
      if (fetchedVods.length === 0) {
        setError('No VODs found for this channel')
      }
    } catch (err) {
      console.error('Failed to fetch VODs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch VODs')
      setVods([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectVod = (vod: VOD) => {
    onSelectVod(vod)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-dark-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-700">
          <h2 className="text-2xl font-bold">Add Stream to Queue</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Channel Search */}
          <form onSubmit={handleSearch} className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Twitch Channel
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Enter channel name (e.g., shroud, pokimane)"
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-10 py-2.5 focus:outline-none focus:border-forge-500"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !channelSearch.trim()}
                className="btn-primary min-w-[120px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* VODs List */}
          {selectedChannel && !loading && vods.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">
                Recent VODs from {selectedChannel}
              </h3>
              <div className="space-y-3">
                {vods.map((vod) => (
                  <button
                    key={vod.id}
                    onClick={() => handleSelectVod(vod)}
                    className="w-full card p-4 hover:border-forge-500 transition-colors text-left"
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="relative w-40 h-24 flex-shrink-0 bg-dark-800 rounded-lg overflow-hidden">
                        <img
                          src={vod.thumbnailUrl.replace('%{width}', '320').replace('%{height}', '180')}
                          alt={vod.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs">
                          {vod.durationFormatted}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate mb-1">{vod.title}</h4>
                        <div className="text-sm text-dark-400 space-y-1">
                          <p>Duration: {vod.durationFormatted}</p>
                          <p>Views: {vod.viewCount.toLocaleString()}</p>
                          <p className="text-xs">
                            {new Date(vod.createdAt).toLocaleDateString()} at{' '}
                            {new Date(vod.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* External Link */}
                      <div className="flex items-center">
                        <a
                          href={vod.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-5 h-5 text-dark-400" />
                        </a>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no search performed */}
          {!selectedChannel && !loading && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400">
                Enter a Twitch channel name to browse their VODs
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-forge-500 animate-spin mx-auto mb-4" />
              <p className="text-dark-400">Loading VODs...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
