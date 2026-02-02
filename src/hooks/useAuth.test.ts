import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuth } from './useAuth'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

// Mock the Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

// Mock the store
vi.mock('@/store', () => ({
  useStore: vi.fn(() => ({
    user: {
      id: null,
      twitchConnected: false,
      tiktokConnected: false,
      youtubeConnected: false,
    },
    setUser: vi.fn(),
  })),
}))

describe('useAuth', () => {
  const mockSetUser = vi.fn()
  const mockUnsubscribe = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should check auth on mount', async () => {
      const mockSession: Session = {
        user: {
          id: 'test-user-id',
          user_metadata: {
            provider_id: 'twitch-123',
          },
        },
      } as Session

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(supabase.auth.getSession).toHaveBeenCalled()
    })

    it('should set up auth state change listener', () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      renderHook(() => useAuth())

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled()
    })

    it('should clean up listener on unmount', () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { unmount } = renderHook(() => useAuth())

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('login', () => {
    it('should call signInWithOAuth with Twitch provider', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: { provider: 'twitch', url: 'https://twitch.tv/auth' },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await result.current.login()

      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'twitch',
        options: {
          redirectTo: window.location.origin,
        },
      })
    })

    it('should handle login errors', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const mockError = new Error('Login failed')
      vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
        data: { provider: 'twitch', url: null },
        error: mockError,
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await result.current.login()

      await waitFor(() => {
        expect(result.current.error).toBe('Login failed')
      })

      expect(consoleSpy).toHaveBeenCalledWith('Login failed:', mockError)

      consoleSpy.mockRestore()
    })
  })

  describe('logout', () => {
    it('should call signOut', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await result.current.logout()

      expect(supabase.auth.signOut).toHaveBeenCalled()
    })

    it('should handle logout errors', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const mockError = new Error('Logout failed')
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: mockError,
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await result.current.logout()

      await waitFor(() => {
        expect(result.current.error).toBe('Logout failed')
      })

      expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', mockError)

      consoleSpy.mockRestore()
    })
  })

  describe('session handling', () => {
    it('should handle valid session', async () => {
      const mockSession: Session = {
        user: {
          id: 'test-user-id',
          user_metadata: {
            provider_id: 'twitch-123',
          },
        },
      } as Session

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false) // Will be updated by setUser mock
    })

    it('should handle null session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should handle session error', async () => {
      const mockError = new Error('Session error')
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: mockError,
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Session error')
      expect(consoleSpy).toHaveBeenCalledWith('Auth check failed:', mockError)

      consoleSpy.mockRestore()
    })
  })

  describe('refresh', () => {
    it('should re-check authentication', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      vi.clearAllMocks()

      await result.current.refresh()

      expect(supabase.auth.getSession).toHaveBeenCalled()
    })
  })
})
