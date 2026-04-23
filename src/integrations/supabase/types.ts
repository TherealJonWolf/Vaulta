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
      admin_alert_settings: {
        Row: {
          admin_user_id: string
          alert_email: string | null
          alert_phone_encrypted: string | null
          categories_enabled: string[]
          created_at: string
          daily_digest_enabled: boolean
          daily_digest_hour: number
          id: string
          min_severity_email: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          alert_email?: string | null
          alert_phone_encrypted?: string | null
          categories_enabled?: string[]
          created_at?: string
          daily_digest_enabled?: boolean
          daily_digest_hour?: number
          id?: string
          min_severity_email?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          alert_email?: string | null
          alert_phone_encrypted?: string | null
          categories_enabled?: string[]
          created_at?: string
          daily_digest_enabled?: boolean
          daily_digest_hour?: number
          id?: string
          min_severity_email?: string
          updated_at?: string
        }
        Relationships: []
      }
      alert_history: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          category: string
          created_at: string
          delivered_at: string | null
          delivery_channel: string
          delivery_status: string
          detail: string | null
          id: string
          incident_id: string | null
          metadata: Json | null
          recipient_admin_id: string
          severity: string
          source_id: string | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          category?: string
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string
          delivery_status?: string
          detail?: string | null
          id?: string
          incident_id?: string | null
          metadata?: Json | null
          recipient_admin_id: string
          severity?: string
          source_id?: string | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          category?: string
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string
          delivery_status?: string
          detail?: string | null
          id?: string
          incident_id?: string | null
          metadata?: Json | null
          recipient_admin_id?: string
          severity?: string
          source_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
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
      consent_records: {
        Row: {
          consent_given_at: string
          consent_text_hash: string
          created_at: string
          document_ids: string[]
          document_names: string[]
          id: string
          institution_id: string
          legal_basis: string
          possession_request_id: string
          retention_period: string
          user_id: string
        }
        Insert: {
          consent_given_at?: string
          consent_text_hash: string
          created_at?: string
          document_ids?: string[]
          document_names?: string[]
          id?: string
          institution_id: string
          legal_basis: string
          possession_request_id: string
          retention_period: string
          user_id: string
        }
        Update: {
          consent_given_at?: string
          consent_text_hash?: string
          created_at?: string
          document_ids?: string[]
          document_names?: string[]
          id?: string
          institution_id?: string
          legal_basis?: string
          possession_request_id?: string
          retention_period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_possession_request_id_fkey"
            columns: ["possession_request_id"]
            isOneToOne: false
            referencedRelation: "document_possession_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      consistency_findings: {
        Row: {
          audit_log_entry: string
          confidence_impact: number
          created_at: string
          description: string
          follow_up_action: string
          id: string
          metadata: Json | null
          resolved: boolean
          resolved_at: string | null
          rule_category: string
          rule_id: string
          rule_name: string
          severity: string
          user_id: string
        }
        Insert: {
          audit_log_entry: string
          confidence_impact?: number
          created_at?: string
          description: string
          follow_up_action?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          rule_category: string
          rule_id: string
          rule_name: string
          severity?: string
          user_id: string
        }
        Update: {
          audit_log_entry?: string
          confidence_impact?: number
          created_at?: string
          description?: string
          follow_up_action?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          rule_category?: string
          rule_id?: string
          rule_name?: string
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      cross_account_signals: {
        Row: {
          account_count: number
          confidence_score: number
          created_at: string
          fingerprint_hash: string
          first_seen_at: string
          id: string
          last_seen_at: string
          metadata: Json | null
          severity: string
          signal_type: string
        }
        Insert: {
          account_count?: number
          confidence_score?: number
          created_at?: string
          fingerprint_hash: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json | null
          severity?: string
          signal_type: string
        }
        Update: {
          account_count?: number
          confidence_score?: number
          created_at?: string
          fingerprint_hash?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json | null
          severity?: string
          signal_type?: string
        }
        Relationships: []
      }
      device_health: {
        Row: {
          consecutive_identical_readings: number
          created_at: string
          device_id: string
          id: string
          last_event_id: string | null
          last_seen_at: string
          last_trace_id: string | null
          metadata: Json | null
          status: string
          total_alerts: number
          total_dropped: number
          total_events: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          consecutive_identical_readings?: number
          created_at?: string
          device_id: string
          id?: string
          last_event_id?: string | null
          last_seen_at?: string
          last_trace_id?: string | null
          metadata?: Json | null
          status?: string
          total_alerts?: number
          total_dropped?: number
          total_events?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          consecutive_identical_readings?: number
          created_at?: string
          device_id?: string
          id?: string
          last_event_id?: string | null
          last_seen_at?: string
          last_trace_id?: string | null
          metadata?: Json | null
          status?: string
          total_alerts?: number
          total_dropped?: number
          total_events?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      device_integrity_factors: {
        Row: {
          abnormal_movement_score: number
          behavioral_consistency_score: number
          created_at: string
          device_consistency_score: number
          geolocation_consistency_score: number
          id: string
          insight_summary: string | null
          insights: Json | null
          integrity_score: number
          last_evaluated_at: string
          session_integrity_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          abnormal_movement_score?: number
          behavioral_consistency_score?: number
          created_at?: string
          device_consistency_score?: number
          geolocation_consistency_score?: number
          id?: string
          insight_summary?: string | null
          insights?: Json | null
          integrity_score?: number
          last_evaluated_at?: string
          session_integrity_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          abnormal_movement_score?: number
          behavioral_consistency_score?: number
          created_at?: string
          device_consistency_score?: number
          geolocation_consistency_score?: number
          id?: string
          insight_summary?: string | null
          insights?: Json | null
          integrity_score?: number
          last_evaluated_at?: string
          session_integrity_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_telemetry_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          device_id: string
          id: string
          metadata: Json | null
          resolved: boolean
          resolved_at: string | null
          rule_name: string
          severity: string
          telemetry_event_id: string | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          device_id: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          rule_name: string
          severity?: string
          telemetry_event_id?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          device_id?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          resolved_at?: string | null
          rule_name?: string
          severity?: string
          telemetry_event_id?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_telemetry_alerts_telemetry_event_id_fkey"
            columns: ["telemetry_event_id"]
            isOneToOne: false
            referencedRelation: "device_telemetry_events"
            referencedColumns: ["id"]
          },
        ]
      }
      device_telemetry_events: {
        Row: {
          accuracy: number | null
          alpha: number | null
          altitude: number | null
          beta: number | null
          client_timestamp: string
          created_at: string
          device_id: string
          event_type: string
          gamma: number | null
          heading: number | null
          id: string
          is_valid: boolean
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          processing_latency_ms: number | null
          received_at: string
          server_timestamp: string
          speed: number | null
          trace_id: string
          user_id: string
          validation_errors: string[] | null
        }
        Insert: {
          accuracy?: number | null
          alpha?: number | null
          altitude?: number | null
          beta?: number | null
          client_timestamp?: string
          created_at?: string
          device_id: string
          event_type?: string
          gamma?: number | null
          heading?: number | null
          id?: string
          is_valid?: boolean
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          processing_latency_ms?: number | null
          received_at?: string
          server_timestamp?: string
          speed?: number | null
          trace_id?: string
          user_id: string
          validation_errors?: string[] | null
        }
        Update: {
          accuracy?: number | null
          alpha?: number | null
          altitude?: number | null
          beta?: number | null
          client_timestamp?: string
          created_at?: string
          device_id?: string
          event_type?: string
          gamma?: number | null
          heading?: number | null
          id?: string
          is_valid?: boolean
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          processing_latency_ms?: number | null
          received_at?: string
          server_timestamp?: string
          speed?: number | null
          trace_id?: string
          user_id?: string
          validation_errors?: string[] | null
        }
        Relationships: []
      }
      document_access_log: {
        Row: {
          access_type: string
          accessed_by: string
          consent_record_id: string
          created_at: string
          id: string
          institution_document_id: string
          institution_id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_by: string
          consent_record_id: string
          created_at?: string
          id?: string
          institution_document_id: string
          institution_id: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_by?: string
          consent_record_id?: string
          created_at?: string
          id?: string
          institution_document_id?: string
          institution_id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_consent_record_id_fkey"
            columns: ["consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_log_institution_document_id_fkey"
            columns: ["institution_document_id"]
            isOneToOne: false
            referencedRelation: "institution_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
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
      document_possession_requests: {
        Row: {
          applicant_name: string | null
          applicant_user_id: string
          created_at: string
          declined_reason: string | null
          document_types: string[]
          id: string
          institution_id: string
          legal_basis: string
          legal_basis_detail: string | null
          reference_id: string | null
          requested_by: string
          responded_at: string | null
          retention_expires_at: string | null
          retention_period: string
          status: string
          submission_id: string | null
        }
        Insert: {
          applicant_name?: string | null
          applicant_user_id: string
          created_at?: string
          declined_reason?: string | null
          document_types?: string[]
          id?: string
          institution_id: string
          legal_basis: string
          legal_basis_detail?: string | null
          reference_id?: string | null
          requested_by: string
          responded_at?: string | null
          retention_expires_at?: string | null
          retention_period: string
          status?: string
          submission_id?: string | null
        }
        Update: {
          applicant_name?: string | null
          applicant_user_id?: string
          created_at?: string
          declined_reason?: string | null
          document_types?: string[]
          id?: string
          institution_id?: string
          legal_basis?: string
          legal_basis_detail?: string | null
          reference_id?: string | null
          requested_by?: string
          responded_at?: string | null
          retention_expires_at?: string | null
          retention_period?: string
          status?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_possession_requests_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_possession_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "intake_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_upload_events: {
        Row: {
          created_at: string
          event_type: string
          failure_reason: string | null
          failure_step: string | null
          file_name: string
          file_size: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          security_warnings_issued: number
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          failure_reason?: string | null
          failure_step?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          security_warnings_issued?: number
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          failure_reason?: string | null
          failure_step?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          security_warnings_issued?: number
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_category: Database["public"]["Enums"]["document_category"]
          encrypted_iv: string | null
          encryption_key_hash: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          institution_name: string | null
          is_verified: boolean
          mime_type: string
          source: string | null
          updated_at: string
          user_id: string
          verification_result: Json | null
        }
        Insert: {
          created_at?: string
          document_category?: Database["public"]["Enums"]["document_category"]
          encrypted_iv?: string | null
          encryption_key_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          institution_name?: string | null
          is_verified?: boolean
          mime_type: string
          source?: string | null
          updated_at?: string
          user_id: string
          verification_result?: Json | null
        }
        Update: {
          created_at?: string
          document_category?: Database["public"]["Enums"]["document_category"]
          encrypted_iv?: string | null
          encryption_key_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          institution_name?: string | null
          is_verified?: boolean
          mime_type?: string
          source?: string | null
          updated_at?: string
          user_id?: string
          verification_result?: Json | null
        }
        Relationships: []
      }
      evaluation_metadata: {
        Row: {
          boundary_events: number
          boundary_hugging_score: number
          created_at: string
          id: string
          jitter_epoch: number
          jitter_seed: number
          last_random_audit_at: string | null
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          boundary_events?: number
          boundary_hugging_score?: number
          created_at?: string
          id?: string
          jitter_epoch?: number
          jitter_seed: number
          last_random_audit_at?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          boundary_events?: number
          boundary_hugging_score?: number
          created_at?: string
          id?: string
          jitter_epoch?: number
          jitter_seed?: number
          last_random_audit_at?: string | null
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_events: {
        Row: {
          created_at: string
          detail: string | null
          device_info: string | null
          event_source: string
          event_type: string
          id: string
          incident_id: string
          ip_address: string | null
          metadata: Json | null
          occurred_at: string
          severity: string
          source_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          device_info?: string | null
          event_source: string
          event_type: string
          id?: string
          incident_id: string
          ip_address?: string | null
          metadata?: Json | null
          occurred_at?: string
          severity?: string
          source_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          device_info?: string | null
          event_source?: string
          event_type?: string
          id?: string
          incident_id?: string
          ip_address?: string | null
          metadata?: Json | null
          occurred_at?: string
          severity?: string
          source_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_documents: {
        Row: {
          applicant_name: string | null
          applicant_user_id: string
          consent_record_id: string
          created_at: string
          deleted_at: string | null
          document_type: string
          encrypted_iv: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          institution_id: string
          mime_type: string
          original_document_id: string | null
          possession_request_id: string
          retention_expired_notified: boolean
          retention_expires_at: string | null
          transferred_at: string
        }
        Insert: {
          applicant_name?: string | null
          applicant_user_id: string
          consent_record_id: string
          created_at?: string
          deleted_at?: string | null
          document_type: string
          encrypted_iv?: string | null
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          institution_id: string
          mime_type: string
          original_document_id?: string | null
          possession_request_id: string
          retention_expired_notified?: boolean
          retention_expires_at?: string | null
          transferred_at?: string
        }
        Update: {
          applicant_name?: string | null
          applicant_user_id?: string
          consent_record_id?: string
          created_at?: string
          deleted_at?: string | null
          document_type?: string
          encrypted_iv?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          institution_id?: string
          mime_type?: string
          original_document_id?: string | null
          possession_request_id?: string
          retention_expired_notified?: boolean
          retention_expires_at?: string | null
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_documents_consent_record_id_fkey"
            columns: ["consent_record_id"]
            isOneToOne: false
            referencedRelation: "consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institution_documents_possession_request_id_fkey"
            columns: ["possession_request_id"]
            isOneToOne: false
            referencedRelation: "document_possession_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_settings: {
        Row: {
          accent_color: string | null
          business_address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          display_name: string | null
          id: string
          institution_id: string
          institution_type: string | null
          logo_path: string | null
          updated_at: string
          website_url: string | null
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          business_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution_id: string
          institution_type?: string | null
          logo_path?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          business_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution_id?: string
          institution_type?: string | null
          logo_path?: string | null
          updated_at?: string
          website_url?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_activity_log: {
        Row: {
          applicant_name: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          institution_id: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          applicant_name?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          institution_id: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          applicant_name?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          institution_id?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_activity_log_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_users: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_users_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      intake_links: {
        Row: {
          applicant_name: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          institution_id: string
          reference_id: string
          status: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          applicant_name: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          institution_id: string
          reference_id: string
          status?: string
          submitted_at?: string | null
          token: string
        }
        Update: {
          applicant_name?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          institution_id?: string
          reference_id?: string
          status?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_links_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_submissions: {
        Row: {
          applicant_name: string
          assessed_at: string | null
          assessment_narrative: string | null
          created_at: string
          document_count: number
          document_types: string[] | null
          id: string
          institution_id: string
          intake_link_id: string
          reference_id: string
          score_state: string
          submitted_at: string
          trust_score: number | null
        }
        Insert: {
          applicant_name: string
          assessed_at?: string | null
          assessment_narrative?: string | null
          created_at?: string
          document_count?: number
          document_types?: string[] | null
          id?: string
          institution_id: string
          intake_link_id: string
          reference_id: string
          score_state?: string
          submitted_at?: string
          trust_score?: number | null
        }
        Update: {
          applicant_name?: string
          assessed_at?: string | null
          assessment_narrative?: string | null
          created_at?: string
          document_count?: number
          document_types?: string[] | null
          id?: string
          institution_id?: string
          intake_link_id?: string
          reference_id?: string
          score_state?: string
          submitted_at?: string
          trust_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_submissions_intake_link_id_fkey"
            columns: ["intake_link_id"]
            isOneToOne: false
            referencedRelation: "intake_links"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_saved_applicants: {
        Row: {
          applicant_user_id: string
          id: string
          landlord_user_id: string
          notes: string | null
          saved_at: string
          shared_token_id: string | null
        }
        Insert: {
          applicant_user_id: string
          id?: string
          landlord_user_id: string
          notes?: string | null
          saved_at?: string
          shared_token_id?: string | null
        }
        Update: {
          applicant_user_id?: string
          id?: string
          landlord_user_id?: string
          notes?: string | null
          saved_at?: string
          shared_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landlord_saved_applicants_shared_token_id_fkey"
            columns: ["shared_token_id"]
            isOneToOne: false
            referencedRelation: "shared_profile_tokens"
            referencedColumns: ["id"]
          },
        ]
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
      manual_review_queue: {
        Row: {
          ai_confidence: number
          ai_generated_likelihood: string | null
          ai_issues: Json | null
          ai_summary: string | null
          created_at: string
          document_id: string
          file_name: string
          id: string
          institution_id: string | null
          mime_type: string | null
          review_decision: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          verification_result: Json | null
        }
        Insert: {
          ai_confidence: number
          ai_generated_likelihood?: string | null
          ai_issues?: Json | null
          ai_summary?: string | null
          created_at?: string
          document_id: string
          file_name: string
          id?: string
          institution_id?: string | null
          mime_type?: string | null
          review_decision?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_result?: Json | null
        }
        Update: {
          ai_confidence?: number
          ai_generated_likelihood?: string | null
          ai_issues?: Json | null
          ai_summary?: string | null
          created_at?: string
          document_id?: string
          file_name?: string
          id?: string
          institution_id?: string | null
          mime_type?: string | null
          review_decision?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_review_queue_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_locked_at: string | null
          created_at: string
          email: string
          failed_login_attempts: number
          full_name: string | null
          id: string
          mfa_enabled: boolean | null
          phone: string | null
          preferred_language: string | null
          preferred_name: string | null
          profile_photo_url: string | null
          updated_at: string
          user_id: string
          vault_accent_color: string | null
          vault_display_name: string | null
        }
        Insert: {
          account_locked_at?: string | null
          created_at?: string
          email: string
          failed_login_attempts?: number
          full_name?: string | null
          id?: string
          mfa_enabled?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id: string
          vault_accent_color?: string | null
          vault_display_name?: string | null
        }
        Update: {
          account_locked_at?: string | null
          created_at?: string
          email?: string
          failed_login_attempts?: number
          full_name?: string | null
          id?: string
          mfa_enabled?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          updated_at?: string
          user_id?: string
          vault_accent_color?: string | null
          vault_display_name?: string | null
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
      security_incidents: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_profile_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          label: string | null
          token: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          is_active?: boolean
          label?: string | null
          token: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          token?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      signal_consents: {
        Row: {
          category: Database["public"]["Enums"]["signal_category"]
          consent_text_hash: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          revoked_at: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["signal_category"]
          consent_text_hash: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["signal_category"]
          consent_text_hash?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          source?: string
          updated_at?: string
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
      trust_history: {
        Row: {
          created_at: string
          decay_applied: number | null
          event_type: string
          id: string
          inertia_factor: number | null
          metadata: Json | null
          rules_satisfied: string[] | null
          rules_violated: string[] | null
          trust_delta: number
          trust_score_at_time: number
          user_id: string
        }
        Insert: {
          created_at?: string
          decay_applied?: number | null
          event_type: string
          id?: string
          inertia_factor?: number | null
          metadata?: Json | null
          rules_satisfied?: string[] | null
          rules_violated?: string[] | null
          trust_delta?: number
          trust_score_at_time: number
          user_id: string
        }
        Update: {
          created_at?: string
          decay_applied?: number | null
          event_type?: string
          id?: string
          inertia_factor?: number | null
          metadata?: Json | null
          rules_satisfied?: string[] | null
          rules_violated?: string[] | null
          trust_delta?: number
          trust_score_at_time?: number
          user_id?: string
        }
        Relationships: []
      }
      trust_narratives: {
        Row: {
          assessed_at: string
          assessment_id: string
          created_at: string
          document_count: number
          flag_count: number
          history_months: number | null
          id: string
          institution_name: string | null
          institution_type: string
          metadata: Json | null
          narrative_text: string
          score_state: string
          trust_score: number | null
          user_id: string
        }
        Insert: {
          assessed_at?: string
          assessment_id: string
          created_at?: string
          document_count?: number
          flag_count?: number
          history_months?: number | null
          id?: string
          institution_name?: string | null
          institution_type?: string
          metadata?: Json | null
          narrative_text: string
          score_state: string
          trust_score?: number | null
          user_id: string
        }
        Update: {
          assessed_at?: string
          assessment_id?: string
          created_at?: string
          document_count?: number
          flag_count?: number
          history_months?: number | null
          id?: string
          institution_name?: string | null
          institution_type?: string
          metadata?: Json | null
          narrative_text?: string
          score_state?: string
          trust_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      trust_report_snapshots: {
        Row: {
          audit_metadata: Json
          confidence: number
          consent_snapshot: Json
          generated_at: string
          id: string
          report_hash: string
          signals_summary: Json
          trust_level: Database["public"]["Enums"]["trust_level"]
          trust_score: number
          user_id: string
          version: string
        }
        Insert: {
          audit_metadata?: Json
          confidence?: number
          consent_snapshot?: Json
          generated_at?: string
          id?: string
          report_hash: string
          signals_summary?: Json
          trust_level: Database["public"]["Enums"]["trust_level"]
          trust_score: number
          user_id: string
          version?: string
        }
        Update: {
          audit_metadata?: Json
          confidence?: number
          consent_snapshot?: Json
          generated_at?: string
          id?: string
          report_hash?: string
          signals_summary?: Json
          trust_level?: Database["public"]["Enums"]["trust_level"]
          trust_score?: number
          user_id?: string
          version?: string
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
      trust_signals: {
        Row: {
          category: Database["public"]["Enums"]["signal_category"]
          confidence: number
          created_at: string
          direction: Database["public"]["Enums"]["signal_direction"]
          evaluated_at: string
          expires_at: string | null
          id: string
          metadata: Json
          rule_id: string | null
          source_id: string | null
          source_table: string
          summary: string
          user_id: string
          weight: number
        }
        Insert: {
          category: Database["public"]["Enums"]["signal_category"]
          confidence?: number
          created_at?: string
          direction: Database["public"]["Enums"]["signal_direction"]
          evaluated_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          rule_id?: string | null
          source_id?: string | null
          source_table: string
          summary: string
          user_id: string
          weight?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["signal_category"]
          confidence?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["signal_direction"]
          evaluated_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          rule_id?: string | null
          source_id?: string | null
          source_table?: string
          summary?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vault_passphrases: {
        Row: {
          created_at: string
          id: string
          salt: string
          updated_at: string
          user_id: string
          verification_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          salt: string
          updated_at?: string
          user_id: string
          verification_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          salt?: string
          updated_at?: string
          user_id?: string
          verification_hash?: string
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
      institution_public_info: {
        Row: {
          accent_color: string | null
          display_name: string | null
          institution_id: string | null
          institution_type: string | null
          logo_path: string | null
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          display_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          logo_path?: string | null
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          display_name?: string | null
          institution_id?: string | null
          institution_type?: string | null
          logo_path?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      check_account_locked: { Args: { p_email: string }; Returns: boolean }
      check_document_hash: {
        Args: { p_hash: string }
        Returns: {
          duplicate_count: number
          flag_reason: string
          is_flagged: boolean
        }[]
      }
      ensure_institutional_access: { Args: { _user_id: string }; Returns: Json }
      flag_document_hash: {
        Args: { p_hash: string; p_reason: string }
        Returns: undefined
      }
      get_institution_branding: {
        Args: { p_institution_id: string }
        Returns: {
          accent_color: string
          display_name: string
          institution_id: string
          institution_type: string
          logo_path: string
          welcome_message: string
        }[]
      }
      get_user_institution: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_failed_login: { Args: { p_email: string }; Returns: Json }
      is_email_blacklisted: { Args: { check_email: string }; Returns: boolean }
      is_institutional_member: {
        Args: { _institution_id: string; _user_id: string }
        Returns: boolean
      }
      reset_failed_login: { Args: { p_user_id: string }; Returns: undefined }
      resolve_shared_token: {
        Args: { p_token: string }
        Returns: {
          applicant_email: string
          applicant_name: string
          is_valid: boolean
          token_id: string
          user_id: string
        }[]
      }
      validate_intake_token: {
        Args: { p_token: string }
        Returns: {
          applicant_name: string
          id: string
          institution_name: string
          is_valid: boolean
          reference_id: string
        }[]
      }
      verify_recovery_code: {
        Args: { p_code_hash: string; p_user_id: string }
        Returns: boolean
      }
      verify_trust_report_by_hash: {
        Args: { p_hash: string }
        Returns: {
          generated_at: string
          trust_level: Database["public"]["Enums"]["trust_level"]
          trust_score: number
          valid: boolean
          version: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "landlord"
      document_category: "identity" | "financial" | "general"
      signal_category:
        | "device_consistency"
        | "geolocation_context"
        | "behavioral_pattern"
        | "utility_corroboration"
        | "cross_account"
        | "identity_verification"
        | "document_consistency"
      signal_direction: "positive" | "neutral" | "negative"
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
      app_role: ["admin", "moderator", "user", "landlord"],
      document_category: ["identity", "financial", "general"],
      signal_category: [
        "device_consistency",
        "geolocation_context",
        "behavioral_pattern",
        "utility_corroboration",
        "cross_account",
        "identity_verification",
        "document_consistency",
      ],
      signal_direction: ["positive", "neutral", "negative"],
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
