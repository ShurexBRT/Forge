export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" }
  public: {
    Tables: {
      acceptance_criteria: {
        Row: { created_at: string; done: boolean; id: string; sort_order: number; text: string; ticket_id: string }
        Insert: { created_at?: string; done?: boolean; id?: string; sort_order?: number; text: string; ticket_id: string }
        Update: { created_at?: string; done?: boolean; id?: string; sort_order?: number; text?: string; ticket_id?: string }
        Relationships: [{ foreignKeyName: "acceptance_criteria_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }]
      }
      agent_runs: {
        Row: { completed_at: string | null; created_at: string; id: string; note: string | null; report: string | null; role: string; started_at: string | null; status: string; ticket_id: string; updated_at: string }
        Insert: { completed_at?: string | null; created_at?: string; id?: string; note?: string | null; report?: string | null; role: string; started_at?: string | null; status: string; ticket_id: string; updated_at?: string }
        Update: { completed_at?: string | null; created_at?: string; id?: string; note?: string | null; report?: string | null; role?: string; started_at?: string | null; status?: string; ticket_id?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "agent_runs_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }]
      }
      profiles: {
        Row: { created_at: string; display_name: string | null; email: string; id: string; role: string; updated_at: string }
        Insert: { created_at?: string; display_name?: string | null; email: string; id: string; role?: string; updated_at?: string }
        Update: { created_at?: string; display_name?: string | null; email?: string; id?: string; role?: string; updated_at?: string }
        Relationships: []
      }
      project_members: {
        Row: { access_role: string; assigned_at: string; assigned_by: string | null; project_id: string; user_id: string }
        Insert: { access_role?: string; assigned_at?: string; assigned_by?: string | null; project_id: string; user_id: string }
        Update: { access_role?: string; assigned_at?: string; assigned_by?: string | null; project_id?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "project_members_assigned_by_fkey"; columns: ["assigned_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "project_members_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      projects: {
        Row: { created_at: string; created_by: string; description: string; github_repo: string | null; id: string; key: string; name: string; updated_at: string }
        Insert: { created_at?: string; created_by: string; description?: string; github_repo?: string | null; id?: string; key: string; name: string; updated_at?: string }
        Update: { created_at?: string; created_by?: string; description?: string; github_repo?: string | null; id?: string; key?: string; name?: string; updated_at?: string }
        Relationships: []
      }
      ticket_activity: {
        Row: { action: string; actor_id: string | null; actor_name: string; actor_type: string; created_at: string; id: string; ticket_id: string }
        Insert: { action: string; actor_id?: string | null; actor_name?: string; actor_type?: string; created_at?: string; id?: string; ticket_id: string }
        Update: { action?: string; actor_id?: string | null; actor_name?: string; actor_type?: string; created_at?: string; id?: string; ticket_id?: string }
        Relationships: [{ foreignKeyName: "ticket_activity_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }]
      }
      ticket_comments: {
        Row: { author_id: string | null; author_name: string; author_type: string; body: string; created_at: string; id: string; ticket_id: string; updated_at: string }
        Insert: { author_id?: string | null; author_name?: string; author_type?: string; body: string; created_at?: string; id?: string; ticket_id: string; updated_at?: string }
        Update: { author_id?: string | null; author_name?: string; author_type?: string; body?: string; created_at?: string; id?: string; ticket_id?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "ticket_comments_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }]
      }
      tickets: {
        Row: { assigned_agent: string | null; branch: string | null; created_at: string; created_by: string; description: string; id: string; priority: string; project_id: string; pull_request: string | null; status: string; ticket_number: number; title: string; type: string; updated_at: string }
        Insert: { assigned_agent?: string | null; branch?: string | null; created_at?: string; created_by: string; description?: string; id?: string; priority: string; project_id: string; pull_request?: string | null; status?: string; ticket_number?: never; title: string; type: string; updated_at?: string }
        Update: { assigned_agent?: string | null; branch?: string | null; created_at?: string; created_by?: string; description?: string; id?: string; priority?: string; project_id?: string; pull_request?: string | null; status?: string; ticket_number?: never; title?: string; type?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "tickets_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
