import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { CheckCircle2, ExternalLink } from 'lucide-react'

interface PlatformConnectionProps {
  platform: 'twitch' | 'tiktok' | 'youtube'
  name: string
  description: string
  icon: React.ReactNode
  provider?: 'twitch' | 'google'
}

export function PlatformConnection({
  platform,
  name,
  description,
  icon,
  provider,
}: PlatformConnectionProps) {
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConnected =
    platform === 'twitch'
      ? user.twitchConnected
      : platform === 'tiktok'
        ? user.tiktokConnected
        : user.youtubeConnected

  const handleConnect = async () => {
    if (!provider) {
      setError('OAuth not yet configured for this platform')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?platform=${platform}`,
          scopes:
            provider === 'google'
              ? 'https://www.googleapis.com/auth/youtube.upload'
              : undefined,
        },
      })

      if (signInError) {
        throw signInError
      }
    } catch (err) {
      console.error(`${platform} connection failed:`, err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setLoading(true)
      setError(null)

      // For Twitch, we need to sign out completely
      if (platform === 'twitch') {
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) throw signOutError

        setUser({
          id: null,
          displayName: null,
          login: null,
          avatarUrl: null,
          email: null,
          twitchConnected: false,
          tiktokConnected: false,
          youtubeConnected: false,
        })
      } else {
        // For other platforms, just update the connection status
        setUser({
          [`${platform}Connected`]: false,
        })
      }
    } catch (err) {
      console.error(`${platform} disconnect failed:`, err)
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{name}</p>
            {isConnected && (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>
          <p className="text-sm text-dark-400">
            {isConnected ? 'Connected' : description}
          </p>
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isConnected ? (
          <button
            className="btn-ghost text-red-500 hover:bg-red-500/10"
            onClick={handleDisconnect}
            disabled={loading}
          >
            {loading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            className="btn-secondary"
            onClick={handleConnect}
            disabled={loading || !provider}
          >
            <ExternalLink className="w-4 h-4" />
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}
