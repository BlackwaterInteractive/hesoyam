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
          role: 'user' | 'admin'
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
          role?: 'user' | 'admin'
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
          role?: 'user' | 'admin'
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
          ignored: boolean
          created_at: string
          admin_remapped_at: string | null
          admin_remapped_by: string | null
          steamgriddb_game_id: number | null
          steamgriddb_icon_url: string | null
          steamgriddb_logo_url: string | null
          steamgriddb_hero_url: string | null
          steamgriddb_grid_url: string | null
          assets_enriched: boolean
          curated_at: string | null
          curated_by: string | null
          discord_name: string | null
          discord_aliases: string[] | null
          steam_app_id: string | null
          gog_id: string | null
          epic_id: string | null
          xbox_app_id: string | null
          opencritic_id: string | null
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
          ignored?: boolean
          created_at?: string
          admin_remapped_at?: string | null
          admin_remapped_by?: string | null
          steamgriddb_game_id?: number | null
          steamgriddb_icon_url?: string | null
          steamgriddb_logo_url?: string | null
          steamgriddb_hero_url?: string | null
          steamgriddb_grid_url?: string | null
          assets_enriched?: boolean
          curated_at?: string | null
          curated_by?: string | null
          discord_name?: string | null
          discord_aliases?: string[] | null
          steam_app_id?: string | null
          gog_id?: string | null
          epic_id?: string | null
          xbox_app_id?: string | null
          opencritic_id?: string | null
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
          ignored?: boolean
          created_at?: string
          admin_remapped_at?: string | null
          admin_remapped_by?: string | null
          steamgriddb_game_id?: number | null
          steamgriddb_icon_url?: string | null
          steamgriddb_logo_url?: string | null
          steamgriddb_hero_url?: string | null
          steamgriddb_grid_url?: string | null
          assets_enriched?: boolean
          curated_at?: string | null
          curated_by?: string | null
          discord_name?: string | null
          discord_aliases?: string[] | null
          steam_app_id?: string | null
          gog_id?: string | null
          epic_id?: string | null
          xbox_app_id?: string | null
          opencritic_id?: string | null
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
        Relationships: []
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
      get_admin_platform_overview: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_remap_plan: {
        Args: {
          p_source_id: string
          p_target_igdb_id: number
        }
        Returns: Json
      }
      admin_remap_apply: {
        Args: {
          p_source_id: string
          p_target_igdb_id: number
          p_metadata: Json
          p_expected_mode: string
          p_actor_id: string | null
        }
        Returns: Json
      }
      admin_merge_games: {
        Args: {
          p_source_id: string
          p_target_id: string
          p_metadata: Json
          p_actor_id: string | null
        }
        Returns: Json
      }
      admin_delete_game_plan: {
        Args: {
          p_game_id: string
        }
        Returns: Json
      }
      admin_delete_game: {
        Args: {
          p_game_id: string
          p_actor_id: string | null
        }
        Returns: Json
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

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Profile = Tables<'profiles'>
export type Game = Tables<'games'>
export type GameSession = Tables<'game_sessions'>
export type UserGame = Tables<'user_games'>
export type SystemConfig = Tables<'system_config'>
