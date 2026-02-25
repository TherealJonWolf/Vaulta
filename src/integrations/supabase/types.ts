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
      account_flags: {
        Row: {
          created_at: string
          flag_type: string
          flagged_document_name: string | null
          id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          flag_type?: string
          flagged_document_name?: string | null
          id?: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          flag_type?: string
          flagged_document_name?: string | null
          id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string
          location: string | null
          session_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location?: string | null
          session_token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location?: string | null
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      blacklisted_emails: {
        Row: {
          associated_user_id: string | null
          blacklisted_at: string
          email: string
          id: string
          reason: string
        }
        Insert: {
          associated_user_id?: string | null
          blacklisted_at?: string
          email: string
          id?: string
          reason: string
        }
        Update: {
          associated_user_id?: string | null
          blacklisted_at?: string
          email?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      document_hashes: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          flag_reason: string | null
          id: string
          is_flagged: boolean
          sha256_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          sha256_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          sha256_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          encryption_key_hash: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          institution_name: string | null
          mime_type: string
          source: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encryption_key_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          institution_name?: string | null
          mime_type: string
          source?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encryption_key_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          institution_name?: string | null
          mime_type?: string
          source?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          failure_reason: string | null
          id: string
          ip_address: string | null
          location: string | null
          login_at: string
          mfa_used: boolean | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          login_at?: string
          mfa_used?: boolean | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          login_at?: string
          mfa_used?: boolean | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          mfa_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          mfa_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          mfa_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_description: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_description: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_description?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          approved: boolean
          author_name: string
          company: string
          created_at: string
          id: string
          quote: string
          rating: number
          role: string
          user_id: string | null
        }
        Insert: {
          approved?: boolean
          author_name: string
          company: string
          created_at?: string
          id?: string
          quote: string
          rating?: number
          role: string
          user_id?: string | null
        }
        Update: {
          approved?: boolean
          author_name?: string
          company?: string
          created_at?: string
          id?: string
          quote?: string
          rating?: number
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trust_scores: {
        Row: {
          calculated_at: string
          confidence: string
          created_at: string
          explanation: string
          id: string
          negative_factors: Json
          positive_factors: Json
          recommendations: Json
          trust_level: Database["public"]["Enums"]["trust_level"]
          trust_score: number
          user_id: string
        }
        Insert: {
          calculated_at?: string
          confidence: string
          created_at?: string
          explanation: string
          id?: string
          negative_factors?: Json
          positive_factors?: Json
          recommendations?: Json
          trust_level: Database["public"]["Enums"]["trust_level"]
          trust_score: number
          user_id: string
        }
        Update: {
          calculated_at?: string
          confidence?: string
          created_at?: string
          explanation?: string
          id?: string
          negative_factors?: Json
          positive_factors?: Json
          recommendations?: Json
          trust_level?: Database["public"]["Enums"]["trust_level"]
          trust_score?: number
          user_id?: string
        }
        Relationships: []
      }
      veriff_sessions: {
        Row: {
          created_at: string
          decision: string | null
          id: string
          reason_code: string | null
          session_id: string
          status: string
          updated_at: string
          user_id: string
          vendor_data: string | null
          verification_url: string | null
        }
        Insert: {
          created_at?: string
          decision?: string | null
          id?: string
          reason_code?: string | null
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
          vendor_data?: string | null
          verification_url?: string | null
        }
        Update: {
          created_at?: string
          decision?: string | null
          id?: string
          reason_code?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          vendor_data?: string | null
          verification_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_document_hash: {
        Args: { p_hash: string }
        Returns: {
          duplicate_count: number
          flag_reason: string
          is_flagged: boolean
        }[]
      }
      flag_document_hash: {
        Args: { p_hash: string; p_reason: string }
        Returns: undefined
      }
      is_email_blacklisted: { Args: { check_email: string }; Returns: boolean }
      verify_recovery_code: {
        Args: { p_code_hash: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      trust_level:
        | "restricted"
        | "low_trust"
        | "neutral"
        | "trusted"
        | "highly_trusted"
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
      trust_level: [
        "restricted",
        "low_trust",
        "neutral",
        "trusted",
        "highly_trusted",
      ],
    },
  },
} as const
