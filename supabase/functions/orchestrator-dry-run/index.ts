import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const statusRank: Record<string, number> = { 'Ready to Release': 500, QA: 450, Review: 400, 'In Progress': 350, Ready: 300 }
const priorityRank: Record<string, number> = { Urgent: 40, High: 30, Medium: 20, Low: 10 }
const fallbackRoleByStatus: Record<string, string> = { Ready: 'Planner', 'In Progress': 'Builder', Review: 'Reviewer', QA: 'QA', 'Ready to Release': 'Release' }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const service = createClient(url, serviceKey)
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)
    const { data: profile } = await service.from('profiles').select('id, role').eq('id', userData.user.id).maybeSingle()
    if (!profile || profile.role !== 'admin') return json({ error: 'Admin access required' }, 403)

    const body = await req.json().catch(() => ({}))
    const projectKey = typeof body?.project_key === 'string' ? body.project_key.trim().toUpperCase() : ''
    let projectsQuery = service.from('projects').select('id, key, name')
    if (projectKey) projectsQuery = projectsQuery.eq('key', projectKey)
    const { data: projects, error: projectsError } = await projectsQuery
    if (projectsError) throw projectsError
    const projectIds = (projects ?? []).map((p) => p.id)
    if (!projectIds.length) return json({ selected: null, evaluations: [], notes: ['No matching projects.'] })

    const [directionResult, decisionResult, assignmentResult, ticketResult] = await Promise.all([
      service.from('project_direction').select('project_id, status').in('project_id', projectIds),
      service.from('decision_requests').select('id, project_id, ticket_id, title, status').in('project_id', projectIds).eq('status', 'open'),
      service.from('project_agents').select('project_id, enabled, agent_id, agents(role)').in('project_id', projectIds),
      service.from('tickets').select('id, ticket_number, project_id, title, type, priority, status, assigned_agent, created_at, updated_at').in('project_id', projectIds).in('status', ['Ready', 'In Progress', 'Review', 'QA', 'Ready to Release']),
    ])
    for (const r of [directionResult, decisionResult, assignmentResult, ticketResult]) if (r.error) throw r.error

    const tickets = ticketResult.data ?? []
    const ticketIds = tickets.map((t) => t.id)
    let deps: any[] = [], leases: any[] = [], dependencyTickets: any[] = [], runtimeBlockers: any[] = []
    if (ticketIds.length) {
      const [depResult, leaseResult, blockerResult] = await Promise.all([
        service.from('ticket_dependencies').select('ticket_id, depends_on_ticket_id').in('ticket_id', ticketIds),
        service.from('orchestrator_leases').select('ticket_id, execution_id, agent_id, agent_role, status, lease_until, acquired_at').in('ticket_id', ticketIds).eq('status', 'active'),
        service.from('ticket_runtime_blockers').select('ticket_id, source_role, reason, created_at').in('ticket_id', ticketIds).eq('status', 'active'),
      ])
      if (depResult.error) throw depResult.error
      if (leaseResult.error) throw leaseResult.error
      if (blockerResult.error) throw blockerResult.error
      deps = depResult.data ?? []
      leases = leaseResult.data ?? []
      runtimeBlockers = blockerResult.data ?? []
      const depIds = [...new Set(deps.map((d) => d.depends_on_ticket_id))]
      if (depIds.length) {
        const depTicketsResult = await service.from('tickets').select('id, ticket_number, project_id, title, status').in('id', depIds)
        if (depTicketsResult.error) throw depTicketsResult.error
        dependencyTickets = depTicketsResult.data ?? []
      }
    }

    const projectById = new Map((projects ?? []).map((p) => [p.id, p]))
    const directionByProject = new Map((directionResult.data ?? []).map((r) => [r.project_id, r.status]))
    const decisionsByTicket = new Map((decisionResult.data ?? []).filter((r) => r.ticket_id).map((r) => [r.ticket_id, r]))
    const rolesByProject = new Map<string, Map<string, string>>()
    for (const row of assignmentResult.data ?? []) {
      if (!row.enabled) continue
      const role = Array.isArray(row.agents) ? row.agents[0]?.role : row.agents?.role
      if (!role) continue
      if (!rolesByProject.has(row.project_id)) rolesByProject.set(row.project_id, new Map())
      rolesByProject.get(row.project_id)!.set(role, row.agent_id)
    }
    const depTicketById = new Map(dependencyTickets.map((t) => [t.id, t]))
    const depsByTicket = new Map<string, any[]>()
    for (const d of deps) {
      if (!depsByTicket.has(d.ticket_id)) depsByTicket.set(d.ticket_id, [])
      depsByTicket.get(d.ticket_id)!.push(d)
    }
    const blockerByTicket = new Map(runtimeBlockers.map((b) => [b.ticket_id, b]))
    const now = Date.now()
    const activeLeaseByTicket = new Map<string, any>(), expiredLeaseByTicket = new Map<string, any>()
    for (const l of leases) {
      if (Date.parse(l.lease_until) > now) activeLeaseByTicket.set(l.ticket_id, l)
      else expiredLeaseByTicket.set(l.ticket_id, l)
    }

    const evaluations = tickets.map((ticket) => {
      const project = projectById.get(ticket.project_id)
      const directionStatus = directionByProject.get(ticket.project_id) ?? 'unreviewed'
      const requiredRole = ticket.assigned_agent || fallbackRoleByStatus[ticket.status] || null
      const agentId = requiredRole ? rolesByProject.get(ticket.project_id)?.get(requiredRole) ?? null : null
      const blockers: string[] = [], warnings: string[] = []
      if (!requiredRole) blockers.push('No role can be resolved for current ticket state.')
      else if (!agentId) blockers.push(`Required role ${requiredRole} is not enabled for project.`)
      const decision = decisionsByTicket.get(ticket.id)
      if (decision) blockers.push(`Open Decision Request: ${decision.title}`)
      const runtimeBlocker = blockerByTicket.get(ticket.id)
      if (runtimeBlocker) blockers.push(`Runtime blocker from ${runtimeBlocker.source_role}: ${runtimeBlocker.reason || 'Blocked handoff requires explicit retry.'}`)
      if (directionStatus !== 'defined') {
        if (requiredRole !== 'Planner') blockers.push(`Product Direction is ${directionStatus}; non-Planner execution is blocked.`)
        else warnings.push(`Product Direction is ${directionStatus}; Planner must validate scope or escalate before handoff.`)
      }
      const unresolvedDependencies = (depsByTicket.get(ticket.id) ?? []).map((d) => depTicketById.get(d.depends_on_ticket_id)).filter((d) => d && d.status !== 'Done')
      for (const d of unresolvedDependencies) {
        const depProject = projectById.get(d.project_id)
        blockers.push(`Blocked by ${depProject ? depProject.key : 'ticket'}-${d.ticket_number}: ${d.title} [${d.status}]`)
      }
      const activeLease = activeLeaseByTicket.get(ticket.id)
      if (activeLease) blockers.push(`Active lease held by ${activeLease.agent_role} until ${activeLease.lease_until}.`)
      if (expiredLeaseByTicket.has(ticket.id)) warnings.push('Expired active lease exists and should be recovered before dispatch.')
      const score = (statusRank[ticket.status] ?? 0) + (priorityRank[ticket.priority] ?? 0)
      return {
        ticket_id: ticket.id, ticket_number: ticket.ticket_number,
        ticket_key: project ? `${project.key}-${ticket.ticket_number}` : String(ticket.ticket_number),
        project_key: project?.key ?? null, project_name: project?.name ?? null,
        title: ticket.title, type: ticket.type, priority: ticket.priority, status: ticket.status,
        required_role: requiredRole, agent_id: agentId, direction_status: directionStatus,
        eligible: blockers.length === 0, blockers, warnings, score, updated_at: ticket.updated_at,
      }
    })

    evaluations.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      if (a.score !== b.score) return b.score - a.score
      const at = Date.parse(a.updated_at ?? '') || 0, bt = Date.parse(b.updated_at ?? '') || 0
      if (at !== bt) return at - bt
      return Number(a.ticket_number) - Number(b.ticket_number)
    })
    return json({
      mode: 'dry-run', selected: evaluations.find((i) => i.eligible) ?? null, evaluations,
      policy: {
        finish_work_before_starting_new: true,
        status_order: ['Ready to Release', 'QA', 'Review', 'In Progress', 'Ready'],
        priority_order: ['Urgent', 'High', 'Medium', 'Low'],
        undefined_direction_rule: 'Planner may inspect; non-Planner execution is blocked.',
        dependency_rule: 'All explicit dependencies must be Done.',
        lease_rule: 'No non-expired active lease may exist for the ticket.',
        runtime_blocker_rule: 'Active runtime blockers require an explicit audited unblock before redispatch.',
      },
      limitations: ['This endpoint never claims or mutates tickets.'],
    })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
