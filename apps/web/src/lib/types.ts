export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          privacy: 'public' | 'friends_only' | 'private'
          discord_id: string | null
          discord_connected_at: string | null
          agent_last_seen: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          privacy?: 'public' | 'friends_only' | 'private'
          discord_id?: string | null
          discord_connected_at?: string | null
          agent_last_seen?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          privacy?: 'public' | 'friends_only' | 'private'
          discord_id?: string | null
          discord_connected_at?: string | null
          agent_last_seen?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          id: string
          igdb_id: number | null
          name: string
          slug: string
          cover_url: string | null
          genres: string[]
          developer: string | null
          release_year: number | null
          created_at: string
        }
        Insert: {
          id?: string
          igdb_id?: number | null
          name: string
          slug: string
          cover_url?: string | null
          genres?: string[]
          developer?: string | null
          release_year?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          igdb_id?: number | null
          name?: string
          slug?: string
          cover_url?: string | null
          genres?: string[]
          developer?: string | null
          release_year?: number | null
          created_at?: string
        }
        Relationships: []
      }
      process_signatures: {
        Row: {
          id: string
          process_name: string
          game_id: string
          reported_by: string | null
          confirmed_count: number
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          process_name: string
          game_id: string
          reported_by?: string | null
          confirmed_count?: number
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          process_name?: string
          game_id?: string
          reported_by?: string | null
          confirmed_count?: number
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'process_signatures_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'process_signatures_reported_by_fkey'
            columns: ['reported_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      game_sessions: {
        Row: {
          id: string
          user_id: string
          game_id: string | null
          game_name: string | null
          started_at: string
          ended_at: string | null
          duration_secs: number
          active_secs: number
          idle_secs: number
          source: 'agent' | 'discord'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          game_id?: string | null
          game_name?: string | null
          started_at: string
          ended_at?: string | null
          duration_secs?: number
          active_secs?: number
          idle_secs?: number
          source?: 'agent' | 'discord'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_id?: string | null
          game_name?: string | null
          started_at?: string
          ended_at?: string | null
          duration_secs?: number
          active_secs?: number
          idle_secs?: number
          source?: 'agent' | 'discord'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'game_sessions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'game_sessions_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
        ]
      }
      user_games: {
        Row: {
          user_id: string
          game_id: string
          total_time_secs: number
          total_sessions: number
          first_played: string
          last_played: string
          avg_session_secs: number
        }
        Insert: {
          user_id: string
          game_id: string
          total_time_secs?: number
          total_sessions?: number
          first_played: string
          last_played: string
          avg_session_secs?: number
        }
        Update: {
          user_id?: string
          game_id?: string
          total_time_secs?: number
          total_sessions?: number
          first_played?: string
          last_played?: string
          avg_session_secs?: number
        }
        Relationships: [
          {
            foreignKeyName: 'user_games_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_games_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_overview: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_calendar_data: {
        Args: { p_user_id: string; p_year: number; p_month: number }
        Returns: Json
      }
      get_genre_stats: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_play_patterns: {
        Args: { p_user_id: string }
        Returns: Json
      }
      close_stale_sessions: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: {
      privacy_level: 'public' | 'friends_only' | 'private'
      signature_status: 'pending' | 'approved' | 'rejected'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases for use throughout the application
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Shorthand row types
export type Profile = Tables<'profiles'>
export type Game = Tables<'games'>
export type ProcessSignature = Tables<'process_signatures'>
export type GameSession = Tables<'game_sessions'>
export type UserGame = Tables<'user_games'>
