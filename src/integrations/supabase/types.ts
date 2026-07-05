export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      forest_trees: {
        Row: {
          chunk_x: number
          chunk_z: number
          created_at: string
          habit_log_id: string
          id: string
          owner_id: string
          planted_at: string
          position_x: number
          position_z: number
          rotation_y: number
          scale: number
          tree_species_id: string
        }
        Insert: {
          chunk_x: number
          chunk_z: number
          created_at?: string
          habit_log_id: string
          id?: string
          owner_id: string
          planted_at?: string
          position_x: number
          position_z: number
          rotation_y?: number
          scale?: number
          tree_species_id: string
        }
        Update: {
          chunk_x?: number
          chunk_z?: number
          created_at?: string
          habit_log_id?: string
          id?: string
          owner_id?: string
          planted_at?: string
          position_x?: number
          position_z?: number
          rotation_y?: number
          scale?: number
          tree_species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forest_trees_habit_log_id_fkey"
            columns: ["habit_log_id"]
            isOneToOne: true
            referencedRelation: "habit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forest_trees_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forest_trees_tree_species_id_fkey"
            columns: ["tree_species_id"]
            isOneToOne: false
            referencedRelation: "tree_species"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          client_request_id: string
          created_at: string
          cycle_start: string
          habit_id: string
          id: string
          local_date: string
          logged_at: string
          occurrence_index: number
          user_id: string
        }
        Insert: {
          client_request_id: string
          created_at?: string
          cycle_start: string
          habit_id: string
          id?: string
          local_date: string
          logged_at?: string
          occurrence_index: number
          user_id: string
        }
        Update: {
          client_request_id?: string
          created_at?: string
          cycle_start?: string
          habit_id?: string
          id?: string
          local_date?: string
          logged_at?: string
          occurrence_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          cadence: Database["public"]["Enums"]["habit_cadence"]
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          start_date: string
          target_per_period: number
          tree_species_id: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["habit_visibility"]
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["habit_cadence"]
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          start_date?: string
          target_per_period?: number
          tree_species_id: string
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["habit_visibility"]
        }
        Update: {
          cadence?: Database["public"]["Enums"]["habit_cadence"]
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          start_date?: string
          target_per_period?: number
          tree_species_id?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["habit_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "habits_tree_species_id_fkey"
            columns: ["tree_species_id"]
            isOneToOne: false
            referencedRelation: "tree_species"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          forest_seed: number
          forest_visibility: Database["public"]["Enums"]["forest_visibility"]
          id: string
          onboarding_completed_at: string | null
          reduced_motion: boolean
          sound_enabled: boolean
          timezone: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          forest_seed?: number
          forest_visibility?: Database["public"]["Enums"]["forest_visibility"]
          id: string
          onboarding_completed_at?: string | null
          reduced_motion?: boolean
          sound_enabled?: boolean
          timezone?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          forest_seed?: number
          forest_visibility?: Database["public"]["Enums"]["forest_visibility"]
          id?: string
          onboarding_completed_at?: string | null
          reduced_motion?: boolean
          sound_enabled?: boolean
          timezone?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tree_species: {
        Row: {
          base_scale: number
          biome: string | null
          created_at: string
          id: string
          is_active: boolean
          model_url: string | null
          name: string
          slug: string
          sort_order: number
          thumbnail_url: string | null
        }
        Insert: {
          base_scale?: number
          biome?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          model_url?: string | null
          name: string
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
        }
        Update: {
          base_scale?: number
          biome?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          model_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      block_user: { Args: { _target: string }; Returns: undefined }
      can_view_forest: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      create_habit_with_auto_tree: {
        Args: {
          _cadence: Database["public"]["Enums"]["habit_cadence"]
          _description: string
          _name: string
          _start_date: string
          _target: number
          _visibility: Database["public"]["Enums"]["habit_visibility"]
        }
        Returns: Json
      }
      ensure_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          forest_seed: number
          forest_visibility: Database["public"]["Enums"]["forest_visibility"]
          id: string
          onboarding_completed_at: string | null
          reduced_motion: boolean
          sound_enabled: boolean
          timezone: string
          updated_at: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_visible_forest: {
        Args: { _owner_id: string }
        Returns: {
          habit_name: string
          id: string
          planted_at: string
          position_x: number
          position_z: number
          rotation_y: number
          scale: number
          species_name: string
          species_slug: string
          tree_species_id: string
        }[]
      }
      log_habit_completion: {
        Args: {
          _client_request_id: string
          _habit_id: string
          _local_date: string
        }
        Returns: Json
      }
      unblock_user: { Args: { _target: string }; Returns: undefined }
      undo_habit_log: { Args: { _log_id: string }; Returns: boolean }
    }
    Enums: {
      forest_visibility: "private" | "friends" | "public"
      friendship_status: "pending" | "accepted" | "blocked"
      habit_cadence: "daily" | "weekly"
      habit_visibility: "public" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      forest_visibility: ["private", "friends", "public"],
      friendship_status: ["pending", "accepted", "blocked"],
      habit_cadence: ["daily", "weekly"],
      habit_visibility: ["public", "private"],
    },
  },
} as const
