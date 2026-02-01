import { Plus, Play, Pause, X, ExternalLink } from 'lucide-react'

// Placeholder queue data
const mockQueue = [
  { 
    id: '1', 
    title: 'Late Night Valorant Grind', 
    channel: 'shroud',
    duration: '4:32:15',
    status: 'processing',
    progress: 67,
    clipsFound: 12,
  },
  { 
    id: '2', 
    title: 'Road to Champion', 
    channel: 'pokimane',
    duration: '2:15:42',
    status: 'queued',
    progress: 0,
    clipsFound: 0,
  },
  { 
    id: '3', 
    title: 'Minecraft Speedrun Attempts', 
    channel: 'dream',
    duration: '5:45:30',
    status: 'queued',
    progress: 0,
    clipsFound: 0,
  },
]

export function Queue() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Processing Queue</h1>
          <p className="text-dark-400 mt-1">Streams being analyzed for clips</p>
        </div>
        
        <button className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Stream
        </button>
      </div>
      
      {/* Queue list */}
      <div className="space-y-3">
        {mockQueue.map((item) => (
          <div key={item.id} className="card p-4">
            <div className="flex items-center gap-4">
              {/* Thumbnail placeholder */}
              <div className="w-32 h-20 bg-dark-800 rounded-lg flex-shrink-0 flex items-center justify-center text-dark-600 text-sm">
                Thumbnail
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{item.title}</h3>
                  <a href="#" className="text-dark-400 hover:text-white">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-sm text-dark-400 mt-1">
                  {item.channel} • {item.duration}
                </p>
                
                {/* Progress bar */}
                {item.status === 'processing' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-forge-400">Processing...</span>
                      <span className="text-dark-400">{item.progress}%</span>
                    </div>
                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-forge-500 transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-dark-500 mt-1">
                      {item.clipsFound} potential clips found
                    </p>
                  </div>
                )}
                
                {item.status === 'queued' && (
                  <p className="text-sm text-dark-500 mt-2">Waiting in queue...</p>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.status === 'processing' ? (
                  <button className="btn-secondary p-2">
                    <Pause className="w-4 h-4" />
                  </button>
                ) : (
                  <button className="btn-secondary p-2">
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button className="btn-ghost p-2 text-red-400 hover:text-red-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Empty state */}
      {mockQueue.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-dark-800 rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-dark-500" />
          </div>
          <h3 className="text-lg font-medium">No streams in queue</h3>
          <p className="text-dark-400 mt-1">Add a Twitch VOD to start generating clips</p>
          <button className="btn-primary mt-4">
            Add Your First Stream
          </button>
        </div>
      )}
    </div>
  )
}
