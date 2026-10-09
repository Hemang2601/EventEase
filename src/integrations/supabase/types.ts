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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      event_edit_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          decided_at: string | null
          event_id: string
          id: string
          reason: string
          requester_id: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          event_id: string
          id?: string
          reason: string
          requester_id: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          event_id?: string
          id?: string
          reason?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_edit_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_zones: {
        Row: {
          capacity: number | null
          created_at: string
          event_id: string
          id: string
          name: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          event_id: string
          id?: string
          name: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_zones_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number
          category: string
          checkin_opens_minutes: number
          cover_url: string | null
          created_at: string
          description: string | null
          edit_unlocked: boolean
          host_name: string | null
          host_photo_url: string | null
          id: string
          is_open: boolean
          owner_id: string
          starts_at: string
          title: string
          venue: string | null
        }
        Insert: {
          capacity: number
          category?: string
          checkin_opens_minutes?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          edit_unlocked?: boolean
          host_name?: string | null
          host_photo_url?: string | null
          id?: string
          is_open?: boolean
          owner_id: string
          starts_at?: string
          title: string
          venue?: string | null
        }
        Update: {
          capacity?: number
          category?: string
          checkin_opens_minutes?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          edit_unlocked?: boolean
          host_name?: string | null
          host_photo_url?: string | null
          id?: string
          is_open?: boolean
          owner_id?: string
          starts_at?: string
          title?: string
          venue?: string | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          checked_in_at: string | null
          checked_in_gate: string | null
          code: string
          created_at: string
          department: string | null
          email: string
          event_id: string
          full_name: string
          id: string
          phone: string | null
          user_id: string | null
          zone_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_gate?: string | null
          code: string
          created_at?: string
          department?: string | null
          email: string
          event_id: string
          full_name: string
          id?: string
          phone?: string | null
          user_id?: string | null
          zone_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_in_gate?: string | null
          code?: string
          created_at?: string
          department?: string | null
          email?: string
          event_id?: string
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "event_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          wants_organizer: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          wants_organizer?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          wants_organizer?: boolean
        }
        Relationships: []
      }
      scan_logs: {
        Row: {
          code: string
          created_at: string
          event_id: string
          gate: string | null
          id: string
          participant_id: string | null
          participant_name: string | null
          result: string
          scanned_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          event_id: string
          gate?: string | null
          id?: string
          participant_id?: string | null
          participant_name?: string | null
          result: string
          scanned_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          event_id?: string
          gate?: string | null
          id?: string
          participant_id?: string | null
          participant_name?: string | null
          result?: string
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          email: string
          event_id: string | null
          full_name: string | null
          id: string
          message: string
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          event_id?: string | null
          full_name?: string | null
          id?: string
          message: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: string
          subject: string
          user_id?: string
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string | null
          full_name?: string | null
          id?: string
          message?: string
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          role: Database["public"]["Enums"]["app_role"]
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
      zone_staff: {
        Row: {
          created_at: string
          user_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_staff_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "event_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_decide_edit_request: {
        Args: { _approve: boolean; _note?: string; _request_id: string }
        Returns: Json
      }
      admin_dismiss_request: { Args: { _user_id: string }; Returns: undefined }
      admin_set_role: {
        Args: {
          _enabled: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Json
      }
      can_manage_event: { Args: { _event_id: string }; Returns: boolean }
      cancel_registration: { Args: { _participant_id: string }; Returns: Json }
      check_in_participant: {
        Args: { _code: string; _event_id: string; _gate?: string }
        Returns: Json
      }
      event_stats: {
        Args: { _event_id: string }
        Returns: {
          checked_in: number
          registered: number
        }[]
      }
      get_ticket: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_event_staff: { Args: { _event_id: string }; Returns: boolean }
      is_zone_staff: { Args: { _zone_id: string }; Returns: boolean }
      list_staff_candidates: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      owns_pass: {
        Args: { _p: Database["public"]["Tables"]["participants"]["Row"] }
        Returns: boolean
      }
      register_participant: {
        Args: {
          _department: string
          _email: string
          _event_id: string
          _full_name: string
          _phone: string
        }
        Returns: Json
      }
      request_event_edit: {
        Args: { _event_id: string; _reason: string }
        Returns: Json
      }
      set_participant_zone: {
        Args: { _participant_id: string; _zone_id: string }
        Returns: Json
      }
      switch_registration: {
        Args: { _new_event_id: string; _participant_id: string }
        Returns: Json
      }
      zone_overview: { Args: { _event_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "organizer" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "organizer", "student"],
    },
  },
} as const
