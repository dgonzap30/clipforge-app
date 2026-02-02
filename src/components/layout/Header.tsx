import { Bell, Search, User, ChevronDown, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useState, useRef, useEffect } from 'react'

export function Header() {
  const { user, isAuthenticated, login, logout, loading } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Get user data from store (populated by useAuth)
  const displayName = user.displayName || user.login || 'User'
  const avatarUrl = user.avatarUrl

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

        {!isAuthenticated ? (
          <button
            onClick={login}
            disabled={loading}
            className="flex items-center gap-3 hover:bg-dark-800 rounded-lg p-2 transition-colors disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-forge-400 to-forge-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">Connect Twitch</span>
          </button>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 hover:bg-dark-800 rounded-lg p-2 transition-colors"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-forge-400 to-forge-600 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="text-sm font-medium">{displayName}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => {
                    logout()
                    setDropdownOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
