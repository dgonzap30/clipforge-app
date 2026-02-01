import { Filter, Grid, List, Download, Trash2, Share } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

// Placeholder clip data
const mockClips = [
  { id: '1', title: 'Insane clutch 1v4', game: 'Valorant', duration: '0:32', status: 'ready', thumbnail: null },
  { id: '2', title: 'Chat went crazy', game: 'Just Chatting', duration: '0:18', status: 'ready', thumbnail: null },
  { id: '3', title: 'Epic fail compilation', game: 'Fortnite', duration: '0:45', status: 'processing', thumbnail: null },
  { id: '4', title: 'Donation reaction', game: 'Just Chatting', duration: '0:22', status: 'ready', thumbnail: null },
]

export function Clips() {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clips</h1>
          <p className="text-dark-400 mt-1">Manage your generated clips</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <Filter className="w-4 h-4" />
            Filter
          </button>
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
      
      {/* Clips grid */}
      <div className={cn(
        view === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'space-y-2'
      )}>
        {mockClips.map((clip) => (
          <div key={clip.id} className="card overflow-hidden group">
            {/* Thumbnail */}
            <div className="aspect-[9/16] bg-dark-800 relative">
              <div className="absolute inset-0 flex items-center justify-center text-dark-600">
                {clip.status === 'processing' ? (
                  <div className="animate-pulse">Processing...</div>
                ) : (
                  <span>Thumbnail</span>
                )}
              </div>
              
              {/* Hover actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button className="btn-primary p-2">
                  <Download className="w-4 h-4" />
                </button>
                <button className="btn-secondary p-2">
                  <Share className="w-4 h-4" />
                </button>
                <button className="btn-ghost p-2 text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-mono">
                {clip.duration}
              </div>
            </div>
            
            {/* Info */}
            <div className="p-3">
              <h3 className="font-medium truncate">{clip.title}</h3>
              <p className="text-sm text-dark-400 mt-1">{clip.game}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
