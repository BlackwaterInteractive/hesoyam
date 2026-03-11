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
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          privacy: 'public' | 'friends_only' | 'private'
          discord_id: string | null
          discord_connected_at: string | null
          agent_last_seen: string | null
          in_guild: boolean
          password_set: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          privacy?: 'public' | 'friends_only' | 'private'
          discord_id?: string | null
          discord_connected_at?: string | null
          agent_last_seen?: string | null
          in_guild?: boolean
          password_set?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          privacy?: 'public' | 'friends_only' | 'private'
          discord_id?: string | null
          discord_connected_at?: string | null
          agent_last_seen?: string | null
          in_guild?: boolean
          password_set?: boolean | null
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
          genres: string[] | null
          developer: string | null
          release_year: number | null
          description: string | null
          publisher: string | null
          platforms: string[] | null
          screenshots: string[] | null
          artwork_url: string | null
          igdb_url: string | null
          rating: number | null
          rating_count: number | null
          first_release_date: string | null
          igdb_updated_at: string | null
          metadata_source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          igdb_id?: number | null
          name: string
          slug: string
          cover_url?: string | null
          genres?: string[] | null
          developer?: string | null
          release_year?: number | null
          description?: string | null
          publisher?: string | null
          platforms?: string[] | null
          screenshots?: string[] | null
          artwork_url?: string | null
          igdb_url?: string | null
          rating?: number | null
          rating_count?: number | null
          first_release_date?: string | null
          igdb_updated_at?: string | null
          metadata_source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          igdb_id?: number | null
          name?: string
          slug?: string
          cover_url?: string | null
          genres?: string[] | null
          developer?: string | null
          release_year?: number | null
          description?: string | null
          publisher?: string | null
          platforms?: string[] | null
          screenshots?: string[] | null
          artwork_url?: string | null
          igdb_url?: string | null
          rating?: number | null
          rating_count?: number | null
          first_release_date?: string | null
          igdb_updated_at?: string | null
          metadata_source?: string | null
          created_at?: string
        }
        Relationships: []
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
          first_played?: string
          last_played?: string
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
      user_game_library: {
        Row: {
          id: string
          user_id: string
          game_id: string
          status: 'want_to_play' | 'played' | 'completed'
          notes: string | null
          personal_rating: number | null
          added_at: string
          status_changed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          game_id: string
          status?: 'want_to_play' | 'played' | 'completed'
          notes?: string | null
          personal_rating?: number | null
          added_at?: string
          status_changed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          game_id?: string
          status?: 'want_to_play' | 'played' | 'completed'
          notes?: string | null
          personal_rating?: number | null
          added_at?: string
          status_changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_game_library_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_game_library_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          value: Json
          expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          key: string
          value: Json
          expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          key?: string
          value?: Json
          expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      close_orphaned_discord_sessions: {
        Args: Record<string, never>
        Returns: number
      }
      search_games_fuzzy: {
        Args: { search_term: string }
        Returns: {
          id: string
          name: string
          slug: string
          cover_url: string
        }[]
      }
      search_games_library: {
        Args: { search_term: string }
        Returns: {
          id: string
          name: string
          slug: string
          cover_url: string
          release_year: number | null
          genres: string[] | null
          igdb_id: number | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
export type GameSession = Tables<'game_sessions'>
export type UserGame = Tables<'user_games'>
export type UserGameLibrary = Tables<'user_game_library'>
export type GameStatus = 'want_to_play' | 'played' | 'completed'
