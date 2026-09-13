import { supabase } from '../lib/supabase'
import type {
  AgentCredentialSummary,
  AgentDefinition,
  DecisionRequest,
  IssuedAgentCredential,
  ProjectAgent,
  ProjectDirection,
} from '../types'

function requireSupabase() {
  if (!supabase) throw new Error('Forge Cloud is not configured.')
  return supabase as any
}

export async function fetchProjectGovernance(projectId: string): Promise<{
  direction: ProjectDirection | null
  agents: ProjectAgent[]
  decisions: DecisionRequest[]
}> {
  const client = requireSupabase()

  const [{ data: direction, error: directionError }, { data: assignments, error: agentError }, { data: decisions, error: decisionsError }] = await Promise.all([
    client.from('project_direction').select('*').eq('project_id', projectId).maybeSingle(),
    client
      .from('project_agents')
      .select('project_id, agent_id, enabled, specialization, permissions, agents(id, slug, name, role, description, status, system_prompt_version, default_permissions)')
      .eq('project_id', projectId)
      .order('created_at'),
    client
      .from('decision_requests')
      .select('id, project_id, ticket_id, requested_by_agent_id, title, context, question, options, status, pm_summary, owner_decision, created_at, resolved_at, updated_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ])

  if (directionError) throw directionError
  if (agentError) throw agentError
  if (decisionsError) throw decisionsError

  const mappedAgents: ProjectAgent[] = (assignments ?? []).map((row: any) => ({
    projectId: row.project_id,
    agentId: row.agent_id,
    enabled: row.enabled,
    specialization: row.specialization ?? '',
    permissions: row.permissions ?? {},
    agent: row.agents as AgentDefinition,
  }))

  return {
    direction: direction
      ? {
          projectId: direction.project_id,
          status: direction.status,
          productBrief: direction.product_brief ?? '',
          pmNotes: direction.pm_notes ?? '',
          lastAlignedAt: direction.last_aligned_at,
          updatedAt: direction.updated_at,
        }
      : null,
    agents: mappedAgents,
    decisions: (decisions ?? []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      ticketId: row.ticket_id,
      requestedByAgentId: row.requested_by_agent_id,
      title: row.title,
      context: row.context ?? '',
      question: row.question,
      options: Array.isArray(row.options) ? row.options : [],
      status: row.status,
      pmSummary: row.pm_summary ?? '',
      ownerDecision: row.owner_decision ?? '',
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      updatedAt: row.updated_at,
    })),
  }
}

export async function setProjectAgentEnabled(projectId: string, agentId: string, enabled: boolean) {
  const client = requireSupabase()
  const { error } = await client.from('project_agents').update({ enabled }).eq('project_id', projectId).eq('agent_id', agentId)
  if (error) throw error
}

export async function updateProjectDirection(input: {
  projectId: string
  status: ProjectDirection['status']
  productBrief: string
  pmNotes: string
}) {
  const client = requireSupabase()
  const { error } = await client
    .from('project_direction')
    .update({
      status: input.status,
      product_brief: input.productBrief,
      pm_notes: input.pmNotes,
      last_aligned_at: input.status === 'defined' ? new Date().toISOString() : null,
    })
    .eq('project_id', input.projectId)
  if (error) throw error
}

export async function resolveDecisionRequest(input: {
  id: string
  pmSummary: string
  ownerDecision: string
}) {
  const client = requireSupabase()
  const { error } = await client
    .from('decision_requests')
    .update({
      status: 'resolved',
      pm_summary: input.pmSummary,
      owner_decision: input.ownerDecision,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw error
}

function mapCredential(row: any): AgentCredentialSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    agentId: row.agent_id,
    label: row.label,
    tokenPrefix: row.token_prefix,
    active: row.active,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }
}

export async function listAgentCredentials(projectId: string): Promise<AgentCredentialSummary[]> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('agent-admin', { body: { action: 'list' } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return (data?.credentials ?? []).filter((row: any) => row.project_id === projectId).map(mapCredential)
}

export async function issueAgentCredential(projectId: string, agentId: string, label = 'default'): Promise<IssuedAgentCredential> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('agent-admin', {
    body: { action: 'issue', project_id: projectId, agent_id: agentId, label },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return { ...mapCredential(data.credential), token: data.token }
}

export async function revokeAgentCredential(credentialId: string) {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('agent-admin', {
    body: { action: 'revoke', credential_id: credentialId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
}
