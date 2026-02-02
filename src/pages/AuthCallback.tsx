import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'
import { Loader2 } from 'lucide-react'

export function AuthCallback() {
  const navigate = useNavigate()
  const setUser = useStore((state) => state.setUser)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    handleAuthCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAuthCallback() {
    try {
      // Get the platform from query params
      const queryParams = new URLSearchParams(window.location.search)
      const platform = queryParams.get('platform') as 'twitch' | 'tiktok' | 'youtube' | null

      // Get the auth hash from the URL
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const errorParam = hashParams.get('error')
      const errorDescription = hashParams.get('error_description')

      // Check for OAuth error in URL
      if (errorParam) {
        console.error('OAuth error:', errorParam, errorDescription)
        setError(errorDescription || 'Authentication failed')
        setTimeout(() => navigate('/connect'), 2000)
        return
      }

      // If no tokens in hash, check query params (some providers use query params)
      if (!accessToken && !refreshToken) {
        const queryParams = new URLSearchParams(window.location.search)
        const code = queryParams.get('code')

        if (!code) {
          console.error('No auth code or tokens found')
          setError('No authentication data received')
          setTimeout(() => navigate('/connect'), 2000)
          return
        }
      }

      // Let Supabase handle the session from the URL
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Session error:', sessionError)
        setError(sessionError.message)
        setTimeout(() => navigate('/connect'), 2000)
        return
      }

      if (!data.session) {
        // Try to exchange the code if we have one
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          new URLSearchParams(window.location.search).get('code') || ''
        )

        if (exchangeError) {
          console.error('Code exchange error:', exchangeError)
          setError('Failed to authenticate')
          setTimeout(() => navigate('/connect'), 2000)
          return
        }
      }

      // Update user connection status based on platform
      if (platform === 'tiktok') {
        setUser({ tiktokConnected: true })
      } else if (platform === 'youtube') {
        setUser({ youtubeConnected: true })
      }
      // Twitch connection is handled by useAuth hook

      // Success - redirect to settings if connecting a platform, otherwise dashboard
      navigate(platform && platform !== 'twitch' ? '/settings' : '/', { replace: true })
    } catch (err) {
      console.error('Auth callback error:', err)
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setTimeout(() => navigate('/connect'), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Authentication Failed</h2>
            <p className="text-dark-400 max-w-md">{error}</p>
            <p className="text-dark-500 text-sm">Redirecting to login...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-16 h-16 text-forge-500 animate-spin mx-auto" />
            <h2 className="text-xl font-semibold text-white">Completing authentication...</h2>
            <p className="text-dark-400">Please wait while we set up your account</p>
          </>
        )}
      </div>
    </div>
  )
}
