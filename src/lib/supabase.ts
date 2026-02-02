/**
 * Supabase Client Configuration
 *
 * Provides a configured Supabase client instance for database operations
 * and Realtime subscriptions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Environment variables for Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Database schema types
export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string
          vod_id: string
          vod_url: string
          title: string
          channel_login: string
          duration: number
          status: string
          progress: number
          current_step: string
          clips_found: number
          clip_ids: string[]
          error: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          settings: {
            min_duration: number
            max_duration: number
            sensitivity: 'low' | 'medium' | 'high'
            chat_analysis: boolean
            audio_peaks: boolean
            face_reactions: boolean
            auto_captions: boolean
            output_format: 'vertical' | 'square' | 'horizontal'
          }
        }
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>
      }
    }
  }
}

let supabaseInstance: SupabaseClient<Database> | null = null

/**
 * Get or create the Supabase client singleton
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
      // Return a mock client that throws errors on use
      return createClient(
        'https://placeholder.supabase.co',
        'placeholder-key'
      ) as SupabaseClient<Database>
    }

    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  }

  return supabaseInstance
}

export const supabase = getSupabaseClient()

export default supabase
