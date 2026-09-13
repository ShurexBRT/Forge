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
      agent_credentials: {
        Row: { active: boolean; agent_id: string; created_at: string; created_by: string | null; id: string; label: string; last_used_at: string | null; project_id: string; revoked_at: string | null; token_hash: string; token_prefix: string }
        Insert: { active?: boolean; agent_id: string; created_at?: string; created_by?: string | null; id?: string; label?: string; last_used_at?: string | null; project_id: string; revoked_at?: string | null; token_hash: string; token_prefix: string }
        Update: { active?: boolean; agent_id?: string; created_at?: string; created_by?: string | null; id?: string; label?: string; last_used_at?: string | null; project_id?: string; revoked_at?: string | null; token_hash?: string; token_prefix?: string }
        Relationships: [
          { foreignKeyName: "agent_credentials_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "agent_credentials_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "agent_credentials_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }
        ]
      }
      agent_runs: {
        Row: { agent_id: string | null; completed_at: string | null; created_at: string; id: string; note: string | null; report: string | null; role: string; started_at: string | null; status: string; ticket_id: string; updated_at: string }
        Insert: { agent_id?: string | null; completed_at?: string | null; created_at?: string; id?: string; note?: string | null; report?: string | null; role: string; started_at?: string | null; status: string; ticket_id: string; updated_at?: string }
        Update: { agent_id?: string | null; completed_at?: string | null; created_at?: string; id?: string; note?: string | null; report?: string | null; role?: string; started_at?: string | null; status?: string; ticket_id?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "agent_runs_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "agent_runs_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }
        ]
      }
      agents: {
        Row: { created_at: string; default_permissions: Json; description: string; id: string; name: string; role: string; slug: string; status: string; system_prompt_version: string; updated_at: string }
        Insert: { created_at?: string; default_permissions?: Json; description?: string; id?: string; name: string; role: string; slug: string; status?: string; system_prompt_version?: string; updated_at?: string }
        Update: { created_at?: string; default_permissions?: Json; description?: string; id?: string; name?: string; role?: string; slug?: string; status?: string; system_prompt_version?: string; updated_at?: string }
        Relationships: []
      }
      decision_requests: {
        Row: { context: string; created_at: string; id: string; options: Json; owner_decision: string; pm_summary: string; project_id: string; question: string; requested_by_agent_id: string | null; resolved_at: string | null; status: string; ticket_id: string | null; title: string; updated_at: string }
        Insert: { context?: string; created_at?: string; id?: string; options?: Json; owner_decision?: string; pm_summary?: string; project_id: string; question: string; requested_by_agent_id?: string | null; resolved_at?: string | null; status?: string; ticket_id?: string | null; title: string; updated_at?: string }
        Update: { context?: string; created_at?: string; id?: string; options?: Json; owner_decision?: string; pm_summary?: string; project_id?: string; question?: string; requested_by_agent_id?: string | null; resolved_at?: string | null; status?: string; ticket_id?: string | null; title?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "decision_requests_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "decision_requests_requested_by_agent_id_fkey"; columns: ["requested_by_agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "decision_requests_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }
        ]
      }
      orchestrator_leases: {
        Row: { acquired_at: string; agent_id: string | null; agent_role: string; execution_id: string; heartbeat_at: string; id: string; lease_until: string; metadata: Json; release_reason: string | null; released_at: string | null; status: string; ticket_id: string }
        Insert: { acquired_at?: string; agent_id?: string | null; agent_role: string; execution_id?: string; heartbeat_at?: string; id?: string; lease_until: string; metadata?: Json; release_reason?: string | null; released_at?: string | null; status?: string; ticket_id: string }
        Update: { acquired_at?: string; agent_id?: string | null; agent_role?: string; execution_id?: string; heartbeat_at?: string; id?: string; lease_until?: string; metadata?: Json; release_reason?: string | null; released_at?: string | null; status?: string; ticket_id?: string }
        Relationships: [
          { foreignKeyName: "orchestrator_leases_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "orchestrator_leases_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }
        ]
      }
      profiles: {
        Row: { created_at: string; display_name: string | null; email: string; id: string; role: string; updated_at: string }
        Insert: { created_at?: string; display_name?: string | null; email: string; id: string; role?: string; updated_at?: string }
        Update: { created_at?: string; display_name?: string | null; email?: string; id?: string; role?: string; updated_at?: string }
        Relationships: []
      }
      project_agents: {
        Row: { agent_id: string; created_at: string; enabled: boolean; permissions: Json; project_id: string; specialization: string; updated_at: string }
        Insert: { agent_id: string; created_at?: string; enabled?: boolean; permissions?: Json; project_id: string; specialization?: string; updated_at?: string }
        Update: { agent_id?: string; created_at?: string; enabled?: boolean; permissions?: Json; project_id?: string; specialization?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "project_agents_agent_id_fkey"; columns: ["agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "project_agents_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }
        ]
      }
      project_direction: {
        Row: { created_at: string; last_aligned_at: string | null; pm_notes: string; product_brief: string; project_id: string; status: string; updated_at: string }
        Insert: { created_at?: string; last_aligned_at?: string | null; pm_notes?: string; product_brief?: string; project_id: string; status?: string; updated_at?: string }
        Update: { created_at?: string; last_aligned_at?: string | null; pm_notes?: string; product_brief?: string; project_id?: string; status?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "project_direction_project_id_fkey"; columns: ["project_id"]; isOneToOne: true; referencedRelation: "projects"; referencedColumns: ["id"] }]
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
      ticket_dependencies: {
        Row: { created_at: string; created_by: string | null; depends_on_ticket_id: string; id: string; ticket_id: string }
        Insert: { created_at?: string; created_by?: string | null; depends_on_ticket_id: string; id?: string; ticket_id: string }
        Update: { created_at?: string; created_by?: string | null; depends_on_ticket_id?: string; id?: string; ticket_id?: string }
        Relationships: [
          { foreignKeyName: "ticket_dependencies_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "ticket_dependencies_depends_on_ticket_id_fkey"; columns: ["depends_on_ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] },
          { foreignKeyName: "ticket_dependencies_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }
        ]
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
