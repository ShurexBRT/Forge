import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const statusRank: Record<string, number> = {
  'Ready to Release': 500,
  QA: 450,
  Review: 400,
  'In Progress': 350,
  Ready: 300,
}

const priorityRank: Record<string, number> = {
  Urgent: 40,
  High: 30,
  Medium: 20,
  Low: 10,
}

const fallbackRoleByStatus: Record<string, string> = {
  Ready: 'Planner',
  'In Progress': 'Builder',
  Review: 'Reviewer',
  QA: 'QA',
  'Ready to Release': 'Release',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const service = createClient(url, serviceKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

    const { data: profile } = await service
      .from('profiles')
      .select('id, role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const projectKey = typeof body?.project_key === 'string' ? body.project_key.trim().toUpperCase() : ''

    let projectsQuery = service.from('projects').select('id, key, name')
    if (projectKey) projectsQuery = projectsQuery.eq('key', projectKey)
    const { data: projects, error: projectsError } = await projectsQuery
    if (projectsError) throw projectsError

    const projectIds = (projects ?? []).map((project) => project.id)
    if (projectIds.length === 0) {
      return json({ selected: null, evaluations: [], notes: ['No matching projects.'] })
    }

    const [directionResult, decisionResult, assignmentResult, ticketResult] = await Promise.all([
      service.from('project_direction').select('project_id, status').in('project_id', projectIds),
      service.from('decision_requests').select('id, project_id, ticket_id, title, status').in('project_id', projectIds).eq('status', 'open'),
      service.from('project_agents').select('project_id, enabled, agents(role)').in('project_id', projectIds),
      service
        .from('tickets')
        .select('id, ticket_number, project_id, title, type, priority, status, assigned_agent, created_at, updated_at')
        .in('project_id', projectIds)
        .in('status', ['Ready', 'In Progress', 'Review', 'QA', 'Ready to Release']),
    ])

    for (const result of [directionResult, decisionResult, assignmentResult, ticketResult]) {
      if (result.error) throw result.error
    }

    const projectById = new Map((projects ?? []).map((project) => [project.id, project]))
    const directionByProject = new Map((directionResult.data ?? []).map((row) => [row.project_id, row.status]))
    const openDecisionByTicket = new Map(
      (decisionResult.data ?? []).filter((row) => row.ticket_id).map((row) => [row.ticket_id, row]),
    )

    const enabledRolesByProject = new Map<string, Set<string>>()
    for (const row of assignmentResult.data ?? []) {
      if (!row.enabled) continue
      const role = Array.isArray(row.agents) ? row.agents[0]?.role : row.agents?.role
      if (!role) continue
      if (!enabledRolesByProject.has(row.project_id)) enabledRolesByProject.set(row.project_id, new Set())
      enabledRolesByProject.get(row.project_id)!.add(role)
    }

    const evaluations = (ticketResult.data ?? []).map((ticket) => {
      const project = projectById.get(ticket.project_id)
      const directionStatus = directionByProject.get(ticket.project_id) ?? 'unreviewed'
      const requiredRole = ticket.assigned_agent || fallbackRoleByStatus[ticket.status] || null
      const enabledRoles = enabledRolesByProject.get(ticket.project_id) ?? new Set<string>()
      const blockers: string[] = []
      const warnings: string[] = []

      if (!requiredRole) blockers.push('No role can be resolved for current ticket state.')
      else if (!enabledRoles.has(requiredRole)) blockers.push(`Required role ${requiredRole} is not enabled for project.`)

      const decision = openDecisionByTicket.get(ticket.id)
      if (decision) blockers.push(`Open Decision Request: ${decision.title}`)

      if (directionStatus !== 'defined') {
        if (requiredRole !== 'Planner') {
          blockers.push(`Product Direction is ${directionStatus}; non-Planner execution is blocked.`)
        } else {
          warnings.push(`Product Direction is ${directionStatus}; Planner must validate scope or escalate before handoff.`)
        }
      }

      const score = (statusRank[ticket.status] ?? 0) + (priorityRank[ticket.priority] ?? 0)

      return {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        ticket_key: project ? `${project.key}-${ticket.ticket_number}` : String(ticket.ticket_number),
        project_key: project?.key ?? null,
        project_name: project?.name ?? null,
        title: ticket.title,
        type: ticket.type,
        priority: ticket.priority,
        status: ticket.status,
        required_role: requiredRole,
        direction_status: directionStatus,
        eligible: blockers.length === 0,
        blockers,
        warnings,
        score,
        updated_at: ticket.updated_at,
      }
    })

    evaluations.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      if (a.score !== b.score) return b.score - a.score
      const aTime = Date.parse(a.updated_at ?? '') || 0
      const bTime = Date.parse(b.updated_at ?? '') || 0
      if (aTime !== bTime) return aTime - bTime
      return Number(a.ticket_number) - Number(b.ticket_number)
    })

    const selected = evaluations.find((item) => item.eligible) ?? null

    return json({
      mode: 'dry-run',
      selected,
      evaluations,
      policy: {
        finish_work_before_starting_new: true,
        status_order: ['Ready to Release', 'QA', 'Review', 'In Progress', 'Ready'],
        priority_order: ['Urgent', 'High', 'Medium', 'Low'],
        undefined_direction_rule: 'Planner may inspect; non-Planner execution is blocked.',
      },
      limitations: [
        'Explicit ticket dependency metadata is not modeled yet, so dependency blocking is not enforced by this version.',
        'This endpoint never claims or mutates tickets.',
      ],
    })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
