import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export function useAuth() {
  const { user, setUser } = useStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check initial session
    checkAuth()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthStateChange(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  function handleAuthStateChange(session: Session | null) {
    if (session?.user) {
      // Extract Twitch user ID from metadata if available
      const twitchUserId = session.user.user_metadata?.provider_id || session.user.id

      setUser({
        id: twitchUserId,
        twitchConnected: true,
      })
      setLoading(false)
    } else {
      setUser({
        id: null,
        twitchConnected: false,
      })
      setLoading(false)
    }
  }

  async function checkAuth() {
    try {
      setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      handleAuthStateChange(session)
    } catch (err) {
      console.error('Auth check failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to check auth')
      setUser({
        id: null,
        displayName: null,
        login: null,
        avatarUrl: null,
        email: null,
        twitchConnected: false,
      })
      setLoading(false)
    }
  }

  async function login() {
    try {
      setError(null)

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',
        options: {
          redirectTo: window.location.origin,
        },
      })

      if (signInError) {
        throw signInError
      }
    } catch (err) {
      console.error('Login failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to login')
    }
  }

  async function logout() {
    try {
      setError(null)

      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        throw signOutError
      }

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
    } catch (err) {
      console.error('Logout failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to logout')
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated: user.twitchConnected,
    login,
    logout,
    refresh: checkAuth,
  }
}
