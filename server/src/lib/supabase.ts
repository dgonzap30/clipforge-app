import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Create a single Supabase client for the server using service role key
// This bypasses RLS and should only be used on the server
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Database types (will be auto-generated later)
export type Database = {
  public: {
    Tables: {
      clips: {
        Row: {
          id: string
          user_id: string
          job_id: string
          vod_id: string
          title: string
          start_time: number
          end_time: number
          duration: number
          status: 'processing' | 'ready' | 'exported' | 'failed'
          video_path: string | null
          thumbnail_path: string | null
          hyde_score: number
          signals: {
            chatVelocity?: number
            audioPeak?: number
            faceReaction?: number
            viewerClips?: number
          }
          exported_to: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          job_id: string
          vod_id: string
          title: string
          start_time: number
          end_time: number
          duration: number
          status?: 'processing' | 'ready' | 'exported' | 'failed'
          video_path?: string | null
          thumbnail_path?: string | null
          hyde_score: number
          signals: {
            chatVelocity?: number
            audioPeak?: number
            faceReaction?: number
            viewerClips?: number
          }
          exported_to?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          job_id?: string
          vod_id?: string
          title?: string
          start_time?: number
          end_time?: number
          duration?: number
          status?: 'processing' | 'ready' | 'exported' | 'failed'
          video_path?: string | null
          thumbnail_path?: string | null
          hyde_score?: number
          signals?: {
            chatVelocity?: number
            audioPeak?: number
            faceReaction?: number
            viewerClips?: number
          }
          exported_to?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          vod_id: string
          status: string
          progress: number
          created_at: string
          updated_at: string
        }
      }
      vods: {
        Row: {
          id: string
          user_id: string
          title: string
          created_at: string
        }
      }
    }
  }
}
