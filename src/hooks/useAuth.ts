import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { api } from '@/lib/api'

export function useAuth() {
  const { user, setUser } = useStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    checkAuth()
  }, [])
  
  async function checkAuth() {
    try {
      setLoading(true)
      setError(null)

      const { user: twitchUser, authenticated } = await api.auth.getMe()

      if (authenticated && twitchUser) {
        setUser({
          id: twitchUser.id,
          displayName: twitchUser.display_name,
          login: twitchUser.login,
          avatarUrl: twitchUser.profile_image_url,
          email: twitchUser.email,
          twitchConnected: true,
        })
      } else {
        setUser({
          id: null,
          displayName: null,
          login: null,
          avatarUrl: null,
          email: null,
          twitchConnected: false,
        })
      }
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
    } finally {
      setLoading(false)
    }
  }
  
  async function login() {
    window.location.href = api.auth.getLoginUrl()
  }
  
  async function logout() {
    try {
      await api.auth.logout()
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
