import { Bell, Search, User } from 'lucide-react'

export function Header() {
  return (
    <header className="h-16 border-b border-dark-800 bg-dark-900 flex items-center justify-between px-6">
      {/* Search */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Search clips, streams..."
          className="input pl-10"
        />
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-4">
        <button className="btn-ghost p-2 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-forge-500 rounded-full" />
        </button>
        
        <button className="flex items-center gap-3 hover:bg-dark-800 rounded-lg p-2 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-forge-400 to-forge-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium">Connect Twitch</span>
        </button>
      </div>
    </header>
  )
}
