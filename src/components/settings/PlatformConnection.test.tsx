import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlatformConnection } from './PlatformConnection'

// Mock the store
vi.mock('@/store', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      user: {
        id: 'user-123',
        displayName: 'Test User',
        login: 'testuser',
        avatarUrl: null,
        email: 'test@example.com',
        twitchConnected: false,
        tiktokConnected: false,
        youtubeConnected: false,
      },
      setUser: vi.fn(),
    }
    return selector(state)
  }),
}))

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

describe('PlatformConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders platform name and description', () => {
      render(
        <PlatformConnection
          platform="twitch"
          name="Twitch"
          description="For VOD access and streaming"
          provider="twitch"
          icon={
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-white">
              T
            </div>
          }
        />
      )

      expect(screen.getByText('Twitch')).toBeInTheDocument()
      expect(screen.getByText('For VOD access and streaming')).toBeInTheDocument()
    })

    it('shows Connect button when disconnected', () => {
      render(
        <PlatformConnection
          platform="twitch"
          name="Twitch"
          description="For VOD access"
          provider="twitch"
          icon={<div>T</div>}
        />
      )

      const connectButton = screen.getByRole('button', { name: /connect/i })
      expect(connectButton).toBeInTheDocument()
      expect(connectButton).not.toBeDisabled()
    })

    it('disables Connect button when no provider is specified', () => {
      render(
        <PlatformConnection
          platform="tiktok"
          name="TikTok"
          description="For auto-upload"
          icon={<div>T</div>}
        />
      )

      const connectButton = screen.getByRole('button', { name: /connect/i })
      expect(connectButton).toBeDisabled()
    })

    it('renders custom icon', () => {
      render(
        <PlatformConnection
          platform="twitch"
          name="Twitch"
          description="For VOD access"
          provider="twitch"
          icon={<div data-testid="custom-icon">Custom Icon</div>}
        />
      )

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    })
  })

  describe('Platform Support', () => {
    it('supports Twitch platform with twitch provider', () => {
      render(
        <PlatformConnection
          platform="twitch"
          name="Twitch"
          description="For VOD access"
          provider="twitch"
          icon={<div>T</div>}
        />
      )

      expect(screen.getByText('Twitch')).toBeInTheDocument()
    })

    it('supports YouTube platform with google provider', () => {
      render(
        <PlatformConnection
          platform="youtube"
          name="YouTube"
          description="For Shorts upload"
          provider="google"
          icon={<div>Y</div>}
        />
      )

      expect(screen.getByText('YouTube')).toBeInTheDocument()
    })

    it('supports TikTok platform without provider', () => {
      render(
        <PlatformConnection
          platform="tiktok"
          name="TikTok"
          description="For auto-upload"
          icon={<div>T</div>}
        />
      )

      expect(screen.getByText('TikTok')).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('has proper button accessibility', () => {
      render(
        <PlatformConnection
          platform="twitch"
          name="Twitch"
          description="For VOD access"
          provider="twitch"
          icon={<div>T</div>}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent(/connect/i)
    })

    it('displays platform icon in rounded container', () => {
      const { container } = render(
        <PlatformConnection
          platform="twitch"
          name="Twitch"
          description="For VOD access"
          provider="twitch"
          icon={<div className="test-icon">T</div>}
        />
      )

      const iconElement = container.querySelector('.test-icon')
      expect(iconElement).toBeInTheDocument()
    })
  })
})
