import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types
export interface Settings {
  detection: {
    minDuration: number
    maxDuration: number
    sensitivity: 'low' | 'medium' | 'high'
    chatAnalysis: boolean
    audioPeaks: boolean
    faceReactions: boolean
  }
  output: {
    defaultFormat: 'vertical' | 'square' | 'horizontal'
    autoCaptions: boolean
    captionStyle: 'minimal' | 'bold' | 'tiktok'
  }
}

interface AppState {
  // UI-only state
  user: {
    id: string | null
    displayName: string | null
    login: string | null
    avatarUrl: string | null
    email: string | null
    twitchConnected: boolean
    tiktokConnected: boolean
    youtubeConnected: boolean
  }

  // Settings
  settings: Settings

  // Actions
  setUser: (user: Partial<AppState['user']>) => void
  updateSettings: (settings: Partial<Settings>) => void
}

const defaultSettings: Settings = {
  detection: {
    minDuration: 15,
    maxDuration: 60,
    sensitivity: 'medium',
    chatAnalysis: true,
    audioPeaks: true,
    faceReactions: true,
  },
  output: {
    defaultFormat: 'vertical',
    autoCaptions: true,
    captionStyle: 'tiktok',
  },
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: {
        id: null,
        displayName: null,
        login: null,
        avatarUrl: null,
        email: null,
        twitchConnected: false,
        tiktokConnected: false,
        youtubeConnected: false,
      },
      settings: defaultSettings,

      setUser: (user) => set((state) => ({
        user: { ...state.user, ...user }
      })),

      updateSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings }
      })),
    }),
    {
      name: 'clipforge-storage',
    }
  )
)
