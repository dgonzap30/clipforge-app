import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Types
export interface Clip {
  id: string
  title: string
  game: string
  duration: number
  status: 'processing' | 'ready' | 'exported' | 'failed'
  thumbnail?: string
  videoUrl?: string
  createdAt: string
  streamId: string
  hydeScore: number
  signals: {
    chatVelocity?: number
    audioPeak?: number
    faceReaction?: number
    viewerClips?: number
  }
}

export interface QueueItem {
  id: string
  title: string
  channel: string
  vodUrl: string
  duration: number
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  clipsFound: number
  addedAt: string
}

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
  // User
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
  
  // Clips
  clips: Clip[]
  
  // Queue
  queue: QueueItem[]
  
  // Settings
  settings: Settings
  
  // Actions
  setUser: (user: Partial<AppState['user']>) => void
  addClip: (clip: Clip) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  removeClip: (id: string) => void
  addToQueue: (item: QueueItem) => void
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void
  removeFromQueue: (id: string) => void
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
      clips: [],
      queue: [],
      settings: defaultSettings,
      
      setUser: (user) => set((state) => ({ 
        user: { ...state.user, ...user } 
      })),
      
      addClip: (clip) => set((state) => ({ 
        clips: [...state.clips, clip] 
      })),
      
      updateClip: (id, updates) => set((state) => ({
        clips: state.clips.map((c) => c.id === id ? { ...c, ...updates } : c)
      })),
      
      removeClip: (id) => set((state) => ({
        clips: state.clips.filter((c) => c.id !== id)
      })),
      
      addToQueue: (item) => set((state) => ({
        queue: [...state.queue, item]
      })),
      
      updateQueueItem: (id, updates) => set((state) => ({
        queue: state.queue.map((q) => q.id === id ? { ...q, ...updates } : q)
      })),
      
      removeFromQueue: (id) => set((state) => ({
        queue: state.queue.filter((q) => q.id !== id)
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
