/**
 * Supabase database types.
 *
 * This is a hand-authored mirror of supabase/migrations/0001_init.sql so the
 * app is fully typed before a live project exists. Once a project is linked,
 * regenerate with:
 *
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * Keep the migration as the source of truth.
 */

export type SessionStatus = 'active' | 'completed';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          trial_started_at: string;
          has_used_first_export: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          trial_started_at?: string;
          has_used_first_export?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          trial_started_at?: string;
          has_used_first_export?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          status: SessionStatus;
          started_at: string;
          ended_at: string | null;
          export_email: string | null;
          exported_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: SessionStatus;
          started_at?: string;
          ended_at?: string | null;
          export_email?: string | null;
          exported_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: SessionStatus;
          started_at?: string;
          ended_at?: string | null;
          export_email?: string | null;
          exported_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      scans: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          barcode: string;
          quantity: number;
          expression: string | null;
          scanned_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          barcode: string;
          quantity?: number;
          expression?: string | null;
          scanned_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          barcode?: string;
          quantity?: number;
          expression?: string | null;
          scanned_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Session = Database['public']['Tables']['sessions']['Row'];
export type Scan = Database['public']['Tables']['scans']['Row'];
