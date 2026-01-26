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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      alert_configs: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          description: string | null
          entity_ids: string[] | null
          id: string
          is_active: boolean
          keywords: string[] | null
          last_triggered_at: string | null
          name: string
          project_id: string
          threshold_percent: number | null
          trigger_count: number
          updated_at: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          description?: string | null
          entity_ids?: string[] | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          last_triggered_at?: string | null
          name: string
          project_id: string
          threshold_percent?: number | null
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          description?: string | null
          entity_ids?: string[] | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          last_triggered_at?: string | null
          name?: string
          project_id?: string
          threshold_percent?: number | null
          trigger_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_notifications: {
        Row: {
          alert_config_id: string
          id: string
          is_dismissed: boolean
          is_read: boolean
          message: string
          metadata: Json | null
          project_id: string
          read_at: string | null
          severity: string
          title: string
          triggered_at: string
        }
        Insert: {
          alert_config_id: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          metadata?: Json | null
          project_id: string
          read_at?: string | null
          severity?: string
          title: string
          triggered_at?: string
        }
        Update: {
          alert_config_id?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          metadata?: Json | null
          project_id?: string
          read_at?: string | null
          severity?: string
          title?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_alert_config_id_fkey"
            columns: ["alert_config_id"]
            isOneToOne: false
            referencedRelation: "alert_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          activo: boolean
          aliases: string[]
          created_at: string
          descripcion: string | null
          id: string
          metadata: Json | null
          nombre: string
          palabras_clave: string[]
          project_id: string
          tipo: Database["public"]["Enums"]["entity_type"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          aliases?: string[]
          created_at?: string
          descripcion?: string | null
          id?: string
          metadata?: Json | null
          nombre: string
          palabras_clave?: string[]
          project_id: string
          tipo: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          aliases?: string[]
          created_at?: string
          descripcion?: string | null
          id?: string
          metadata?: Json | null
          nombre?: string
          palabras_clave?: string[]
          project_id?: string
          tipo?: Database["public"]["Enums"]["entity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string | null
          id: string
          is_archived: boolean
          is_read: boolean
          matched_keywords: string[]
          project_id: string
          published_at: string | null
          raw_metadata: Json | null
          relevance_score: number | null
          sentiment: string | null
          source_domain: string | null
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          matched_keywords?: string[]
          project_id: string
          published_at?: string | null
          raw_metadata?: Json | null
          relevance_score?: number | null
          sentiment?: string | null
          source_domain?: string | null
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          matched_keywords?: string[]
          project_id?: string
          published_at?: string | null
          raw_metadata?: Json | null
          relevance_score?: number | null
          sentiment?: string | null
          source_domain?: string | null
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          activo: boolean
          alcance_geografico: string[]
          alcance_temporal: Database["public"]["Enums"]["temporal_scope"]
          audiencia: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          objetivo: string
          sensibilidad: Database["public"]["Enums"]["sensitivity_level"]
          tipo: Database["public"]["Enums"]["project_type"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          activo?: boolean
          alcance_geografico?: string[]
          alcance_temporal?: Database["public"]["Enums"]["temporal_scope"]
          audiencia: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          objetivo: string
          sensibilidad?: Database["public"]["Enums"]["sensitivity_level"]
          tipo?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          activo?: boolean
          alcance_geografico?: string[]
          alcance_temporal?: Database["public"]["Enums"]["temporal_scope"]
          audiencia?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          objetivo?: string
          sensibilidad?: Database["public"]["Enums"]["sensitivity_level"]
          tipo?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      social_results: {
        Row: {
          author_avatar_url: string | null
          author_followers: number | null
          author_name: string | null
          author_url: string | null
          author_username: string | null
          author_verified: boolean | null
          comments: number | null
          content_type: string | null
          created_at: string
          description: string | null
          engagement: number | null
          external_id: string | null
          hashtags: string[] | null
          id: string
          job_id: string
          likes: number | null
          mentions: string[] | null
          platform: string
          project_id: string
          published_at: string | null
          raw_data: Json | null
          shares: number | null
          title: string | null
          url: string | null
          views: number | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_followers?: number | null
          author_name?: string | null
          author_url?: string | null
          author_username?: string | null
          author_verified?: boolean | null
          comments?: number | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          engagement?: number | null
          external_id?: string | null
          hashtags?: string[] | null
          id?: string
          job_id: string
          likes?: number | null
          mentions?: string[] | null
          platform: string
          project_id: string
          published_at?: string | null
          raw_data?: Json | null
          shares?: number | null
          title?: string | null
          url?: string | null
          views?: number | null
        }
        Update: {
          author_avatar_url?: string | null
          author_followers?: number | null
          author_name?: string | null
          author_url?: string | null
          author_username?: string | null
          author_verified?: boolean | null
          comments?: number | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          engagement?: number | null
          external_id?: string | null
          hashtags?: string[] | null
          id?: string
          job_id?: string
          likes?: number | null
          mentions?: string[] | null
          platform?: string
          project_id?: string
          published_at?: string | null
          raw_data?: Json | null
          shares?: number | null
          title?: string | null
          url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "social_scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      social_scrape_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          dataset_id: string | null
          error_message: string | null
          id: string
          max_results: number | null
          metadata: Json | null
          platform: string
          project_id: string
          results_count: number | null
          run_id: string | null
          search_type: string
          search_value: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          max_results?: number | null
          metadata?: Json | null
          platform: string
          project_id: string
          results_count?: number | null
          run_id?: string | null
          search_type: string
          search_value: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dataset_id?: string | null
          error_message?: string | null
          id?: string
          max_results?: number | null
          metadata?: Json | null
          platform?: string
          project_id?: string
          results_count?: number | null
          run_id?: string | null
          search_type?: string
          search_value?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_scrape_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      thematic_cards: {
        Row: {
          card_type: string
          content: Json
          created_at: string
          id: string
          mention_ids: string[] | null
          period_end: string | null
          period_start: string | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          card_type: string
          content?: Json
          created_at?: string
          id?: string
          mention_ids?: string[] | null
          period_end?: string | null
          period_start?: string | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          card_type?: string
          content?: Json
          created_at?: string
          id?: string
          mention_ids?: string[] | null
          period_end?: string | null
          period_start?: string | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thematic_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_status: "active" | "paused" | "triggered"
      alert_type: "sentiment_negative" | "mention_spike" | "keyword_match"
      app_role: "admin" | "analista" | "director"
      entity_type: "persona" | "marca" | "institucion"
      project_type: "monitoreo" | "investigacion" | "crisis" | "benchmark"
      sensitivity_level: "bajo" | "medio" | "alto" | "critico"
      temporal_scope:
        | "tiempo_real"
        | "diario"
        | "semanal"
        | "mensual"
        | "historico"
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
      alert_status: ["active", "paused", "triggered"],
      alert_type: ["sentiment_negative", "mention_spike", "keyword_match"],
      app_role: ["admin", "analista", "director"],
      entity_type: ["persona", "marca", "institucion"],
      project_type: ["monitoreo", "investigacion", "crisis", "benchmark"],
      sensitivity_level: ["bajo", "medio", "alto", "critico"],
      temporal_scope: [
        "tiempo_real",
        "diario",
        "semanal",
        "mensual",
        "historico",
      ],
    },
  },
} as const
