import { useState, useEffect } from 'react'
import { X, Search, Loader2, Play, Eye, Calendar, Clock, AlertCircle } from 'lucide-react'
import { api, VOD, ProcessingJob } from '@/lib/api'

interface VodBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  onJobCreated?: (job: ProcessingJob) => void
}

interface ChannelInfo {
  id: string
  login: string
  displayName: string
  profileImageUrl: string
}

export function VodBrowserModal({ isOpen, onClose, onJobCreated }: VodBrowserModalProps) {
  // Search state
  const [channelSearch, setChannelSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Channel and VODs state
  const [channel, setChannel] = useState<ChannelInfo | null>(null)
  const [vods, setVods] = useState<VOD[]>([])
  const [isLoadingVods, setIsLoadingVods] = useState(false)
  const [vodsError, setVodsError] = useState<string | null>(null)

  // Selection state
  const [selectedVod, setSelectedVod] = useState<VOD | null>(null)

  // Processing settings state
  const [settings, setSettings] = useState({
    minDuration: 15,
    maxDuration: 60,
    sensitivity: 'medium' as 'low' | 'medium' | 'high',
    chatAnalysis: true,
    audioPeaks: true,
    faceReactions: true,
    autoCaptions: true,
    outputFormat: 'vertical' as 'vertical' | 'square' | 'horizontal',
  })

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setChannelSearch('')
      setChannel(null)
      setVods([])
      setSelectedVod(null)
      setSearchError(null)
      setVodsError(null)
      setSubmitError(null)
    }
  }, [isOpen])

  const handleSearchChannel = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!channelSearch.trim()) {
      setSearchError('Please enter a channel name')
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setVodsError(null)
    setVods([])
    setSelectedVod(null)

    try {
      const response = await api.vods.getByChannel(channelSearch.trim())
      setChannel(response.channel)
      setVods(response.vods)

      if (response.vods.length === 0) {
        setVodsError('No VODs found for this channel')
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search channel')
      setChannel(null)
      setVods([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmitJob = async () => {
    if (!selectedVod || !channel) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const job = await api.jobs.create({
        vodId: selectedVod.id,
        vodUrl: selectedVod.url,
        title: selectedVod.title,
        channelLogin: channel.login,
        duration: selectedVod.duration,
        settings,
      })

      onJobCreated?.(job)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create job')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="card w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-dark-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">Add VOD to Queue</h2>
            <p className="text-sm text-dark-400 mt-1">
              Search for a channel, select a VOD, and configure processing settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2 text-dark-400 hover:text-white"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Channel Search */}
          <section>
            <h3 className="text-lg font-semibold mb-3">1. Search Twitch Channel</h3>
            <form onSubmit={handleSearchChannel} className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                <input
                  type="text"
                  placeholder="Enter channel name (e.g., shroud, pokimane)"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className="input pl-10 w-full"
                  disabled={isSearching}
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSearching || !channelSearch.trim()}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>
            </form>

            {searchError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{searchError}</p>
              </div>
            )}

            {channel && (
              <div className="mt-3 p-3 bg-dark-800 rounded-lg flex items-center gap-3">
                <img
                  src={channel.profileImageUrl}
                  alt={channel.displayName}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <p className="font-medium">{channel.displayName}</p>
                  <p className="text-sm text-dark-400">@{channel.login}</p>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: VOD Selection */}
          {vods.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-3">2. Select a VOD</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {vods.map((vod) => (
                  <button
                    key={vod.id}
                    onClick={() => setSelectedVod(vod)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      selectedVod?.id === vod.id
                        ? 'border-forge-500 bg-forge-500/10'
                        : 'border-dark-700 bg-dark-800 hover:border-dark-600'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={vod.thumbnailUrl}
                          alt={vod.title}
                          className="w-40 h-24 object-cover rounded"
                        />
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs font-medium">
                          {vod.durationFormatted}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{vod.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-dark-400">
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {vod.viewCount.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(vod.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {vod.durationFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {vodsError && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-400">{vodsError}</p>
            </div>
          )}

          {/* Step 3: Processing Settings */}
          {selectedVod && (
            <section>
              <h3 className="text-lg font-semibold mb-3">3. Configure Processing Settings</h3>

              <div className="space-y-4">
                {/* Duration Range */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Clip Duration Range
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-dark-400">Min (seconds)</label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={settings.minDuration}
                        onChange={(e) => setSettings({ ...settings, minDuration: Number(e.target.value) })}
                        className="input mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-dark-400">Max (seconds)</label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={settings.maxDuration}
                        onChange={(e) => setSettings({ ...settings, maxDuration: Number(e.target.value) })}
                        className="input mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Sensitivity */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Detection Sensitivity
                  </label>
                  <select
                    value={settings.sensitivity}
                    onChange={(e) => setSettings({ ...settings, sensitivity: e.target.value as 'low' | 'medium' | 'high' })}
                    className="input"
                  >
                    <option value="low">Low - Fewer clips, higher quality</option>
                    <option value="medium">Medium - Balanced</option>
                    <option value="high">High - More clips, some may be lower quality</option>
                  </select>
                </div>

                {/* Detection Methods */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.chatAnalysis}
                      onChange={(e) => setSettings({ ...settings, chatAnalysis: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
                    />
                    <div>
                      <span className="font-medium">Chat Analysis</span>
                      <p className="text-sm text-dark-400">Detect moments with high chat activity</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.audioPeaks}
                      onChange={(e) => setSettings({ ...settings, audioPeaks: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
                    />
                    <div>
                      <span className="font-medium">Audio Peaks</span>
                      <p className="text-sm text-dark-400">Detect loud/hype moments from audio</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.faceReactions}
                      onChange={(e) => setSettings({ ...settings, faceReactions: e.target.checked })}
                      className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
                    />
                    <div>
                      <span className="font-medium">Face Reactions</span>
                      <p className="text-sm text-dark-400">Analyze streamer face cam for reactions</p>
                    </div>
                  </label>
                </div>

                {/* Output Settings */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Output Format
                  </label>
                  <select
                    value={settings.outputFormat}
                    onChange={(e) => setSettings({ ...settings, outputFormat: e.target.value as 'vertical' | 'square' | 'horizontal' })}
                    className="input"
                  >
                    <option value="vertical">Vertical (9:16) - TikTok, Reels, Shorts</option>
                    <option value="square">Square (1:1) - Instagram Feed</option>
                    <option value="horizontal">Horizontal (16:9) - YouTube, Twitter</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoCaptions}
                    onChange={(e) => setSettings({ ...settings, autoCaptions: e.target.checked })}
                    className="w-5 h-5 rounded border-dark-600 bg-dark-800 text-forge-500 focus:ring-forge-500"
                  />
                  <div>
                    <span className="font-medium">Auto Captions</span>
                    <p className="text-sm text-dark-400">Generate animated captions automatically</p>
                  </div>
                </label>
              </div>
            </section>
          )}

          {submitError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-800 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmitJob}
            className="btn-primary"
            disabled={!selectedVod || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding to Queue...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Add to Queue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
