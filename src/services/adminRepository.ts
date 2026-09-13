import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ProjectMembership, UserProfile } from '../types'

interface ProfileRow {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'member'
  created_at: string
}

interface MembershipRow {
  project_id: string
  user_id: string
  access_role: 'member' | 'manager'
  assigned_at: string
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function profileFromRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? undefined,
    role: row.role,
    createdAt: row.created_at,
  }
}

function membershipFromRow(row: MembershipRow): ProjectMembership {
  return {
    projectId: row.project_id,
    userId: row.user_id,
    accessRole: row.access_role,
    assignedAt: row.assigned_at,
  }
}

export async function fetchCurrentProfile(userId: string) {
  const db = client()
  const { data, error } = await db
    .from('profiles')
    .select('id,email,display_name,role,created_at')
    .eq('id', userId)
    .single()

  if (error) throw error
  return profileFromRow(data as ProfileRow)
}

export async function fetchAdminAccessData() {
  const db = client()

  const [{ data: profileData, error: profileError }, { data: membershipData, error: membershipError }] = await Promise.all([
    db.from('profiles').select('id,email,display_name,role,created_at').order('created_at', { ascending: true }),
    db.from('project_members').select('project_id,user_id,access_role,assigned_at').order('assigned_at', { ascending: true }),
  ])

  if (profileError) throw profileError
  if (membershipError) throw membershipError

  return {
    users: (profileData as ProfileRow[]).map(profileFromRow),
    memberships: (membershipData as MembershipRow[]).map(membershipFromRow),
  }
}

export async function setProjectMembership(
  projectId: string,
  userId: string,
  assigned: boolean,
  admin: User,
) {
  const db = client()

  if (assigned) {
    const { error } = await db.from('project_members').upsert(
      {
        project_id: projectId,
        user_id: userId,
        access_role: 'member',
        assigned_by: admin.id,
      },
      { onConflict: 'project_id,user_id' },
    )
    if (error) throw error
    return
  }

  const { error } = await db
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw error
}
