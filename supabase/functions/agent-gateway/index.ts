import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forge-agent-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function roleStatuses(role: string) {
  if (role === 'Planner' || role === 'Builder') return ['Ready', 'In Progress']
  if (role === 'Reviewer') return ['Review']
  if (role === 'QA' || role === 'Browser') return ['QA']
  if (role === 'Release') return ['Ready to Release']
  return []
}
function priorityScore(priority: string) { return { Urgent: 0, High: 1, Medium: 2, Low: 3 }[priority] ?? 9 }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const rawToken = req.headers.get('x-forge-agent-token')
    if (!rawToken) return json({ error: 'Missing x-forge-agent-token' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const service = createClient(url, serviceKey)
    const tokenHash = await sha256(rawToken)

    const { data: credential, error: credentialError } = await service
      .from('agent_credentials')
      .select('id, project_id, agent_id, active, agents(id, name, role, status), projects(id, key, name)')
      .eq('token_hash', tokenHash).eq('active', true).maybeSingle()
    if (credentialError) throw credentialError
    if (!credential) return json({ error: 'Invalid or revoked agent token' }, 401)
    const agent = credential.agents as any, project = credential.projects as any
    if (!agent || agent.status !== 'active') return json({ error: 'Agent is disabled' }, 403)

    const { data: assignment } = await service.from('project_agents').select('enabled, specialization, permissions')
      .eq('project_id', credential.project_id).eq('agent_id', credential.agent_id).maybeSingle()
    if (!assignment?.enabled) return json({ error: 'Agent is not enabled for this project' }, 403)
    await service.from('agent_credentials').update({ last_used_at: new Date().toISOString() }).eq('id', credential.id)

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action ?? '')

    async function resolveTicket() {
      if (body?.ticket_id) {
        const { data } = await service.from('tickets').select('*').eq('id', String(body.ticket_id)).eq('project_id', credential.project_id).maybeSingle()
        return data
      }
      const key = String(body?.ticket_key ?? '')
      const match = key.match(/^([A-Z][A-Z0-9]{1,9})-(\d+)$/)
      if (!match || match[1] !== project.key) return null
      const { data } = await service.from('tickets').select('*').eq('project_id', credential.project_id).eq('ticket_number', Number(match[2])).maybeSingle()
      return data
    }

    async function guard(ticket: any) {
      const blockers: string[] = [], warnings: string[] = []
      const [{ data: direction }, { data: decisions }, { data: deps }] = await Promise.all([
        service.from('project_direction').select('status').eq('project_id', credential.project_id).maybeSingle(),
        service.from('decision_requests').select('id, title').eq('ticket_id', ticket.id).eq('status', 'open'),
        service.from('ticket_dependencies').select('depends_on_ticket_id').eq('ticket_id', ticket.id),
      ])
      if ((direction?.status ?? 'unreviewed') !== 'defined') {
        if (agent.role !== 'Planner') blockers.push(`Product Direction is ${direction?.status ?? 'unreviewed'}; only Planner may inspect/escalate.`)
        else warnings.push(`Product Direction is ${direction?.status ?? 'unreviewed'}; do not hand off implementation without alignment.`)
      }
      for (const d of decisions ?? []) blockers.push(`Open Decision Request: ${d.title}`)
      const depIds = (deps ?? []).map((d) => d.depends_on_ticket_id)
      if (depIds.length) {
        const { data: depTickets } = await service.from('tickets').select('id, ticket_number, title, status, projects(key)').in('id', depIds)
        for (const d of depTickets ?? []) {
          if (d.status !== 'Done') {
            const p = Array.isArray(d.projects) ? d.projects[0] : d.projects
            blockers.push(`Blocked by ${p?.key ?? 'ticket'}-${d.ticket_number}: ${d.title} [${d.status}]`)
          }
        }
      }
      return { blockers, warnings, direction_status: direction?.status ?? 'unreviewed' }
    }

    async function expireStaleLease(ticketId: string) {
      const now = new Date().toISOString()
      await service.from('orchestrator_leases')
        .update({ status: 'expired', released_at: now, release_reason: 'Lease expired before gateway action' })
        .eq('ticket_id', ticketId).eq('status', 'active').lte('lease_until', now)
    }

    async function getActiveLease(ticketId: string) {
      await expireStaleLease(ticketId)
      const { data } = await service.from('orchestrator_leases').select('*').eq('ticket_id', ticketId).eq('status', 'active').maybeSingle()
      return data
    }

    async function bundle(ticket: any) {
      const [{ data: criteria }, { data: comments }, { data: runs }, { data: direction }, { data: decisions }, { data: deps }, { data: lease }] = await Promise.all([
        service.from('acceptance_criteria').select('*').eq('ticket_id', ticket.id).order('sort_order'),
        service.from('ticket_comments').select('*').eq('ticket_id', ticket.id).order('created_at'),
        service.from('agent_runs').select('*').eq('ticket_id', ticket.id).order('created_at'),
        service.from('project_direction').select('*').eq('project_id', credential.project_id).maybeSingle(),
        service.from('decision_requests').select('*').eq('project_id', credential.project_id).eq('status', 'open').order('created_at'),
        service.from('ticket_dependencies').select('depends_on_ticket_id').eq('ticket_id', ticket.id),
        service.from('orchestrator_leases').select('execution_id, agent_id, agent_role, status, acquired_at, lease_until, heartbeat_at').eq('ticket_id', ticket.id).eq('status', 'active').maybeSingle(),
      ])
      const depIds = (deps ?? []).map((d) => d.depends_on_ticket_id)
      let dependencyTickets: any[] = []
      if (depIds.length) {
        const { data } = await service.from('tickets').select('id, ticket_number, title, status, projects(key)').in('id', depIds)
        dependencyTickets = data ?? []
      }
      return { ticket, criteria: criteria ?? [], comments: comments ?? [], agent_runs: runs ?? [], project_direction: direction, open_decisions: decisions ?? [], dependencies: dependencyTickets, active_lease: lease, project, agent: { id: agent.id, name: agent.name, role: agent.role, specialization: assignment.specialization, permissions: assignment.permissions } }
    }

    if (action === 'next_ticket') {
      const { data, error } = await service.from('tickets').select('*').eq('project_id', credential.project_id).eq('assigned_agent', agent.role).in('status', roleStatuses(agent.role)).limit(50)
      if (error) throw error
      const candidates = [...(data ?? [])].sort((a, b) => priorityScore(a.priority) - priorityScore(b.priority) || a.ticket_number - b.ticket_number)
      for (const ticket of candidates) {
        const gates = await guard(ticket)
        const lease = await getActiveLease(ticket.id)
        if (!gates.blockers.length && !lease) return json({ ...(await bundle(ticket)), guard: gates })
      }
      return json({ ticket: null, project, agent: { name: agent.name, role: agent.role } })
    }

    if (action === 'get_ticket') {
      const ticket = await resolveTicket()
      if (!ticket) return json({ error: 'Ticket not found for this project' }, 404)
      return json({ ...(await bundle(ticket)), guard: await guard(ticket) })
    }

    if (action === 'claim') {
      const ticket = await resolveTicket()
      if (!ticket) return json({ error: 'Ticket not found for this project' }, 404)
      if (ticket.assigned_agent !== agent.role) return json({ error: `Ticket is assigned to ${ticket.assigned_agent ?? 'nobody'}, not ${agent.role}` }, 409)
      if (!roleStatuses(agent.role).includes(ticket.status)) return json({ error: `Ticket status ${ticket.status} is not claimable by ${agent.role}` }, 409)
      const gates = await guard(ticket)
      if (gates.blockers.length) return json({ error: 'Ticket is blocked', blockers: gates.blockers }, 409)

      await expireStaleLease(ticket.id)
      let lease: any = null
      const requestedExecution = body?.execution_id ? String(body.execution_id) : ''
      if (requestedExecution) {
        const { data } = await service.from('orchestrator_leases').select('*').eq('execution_id', requestedExecution).eq('ticket_id', ticket.id).eq('agent_id', agent.id).eq('agent_role', agent.role).eq('status', 'active').maybeSingle()
        if (!data || Date.parse(data.lease_until) <= Date.now()) return json({ error: 'Dispatch lease is missing, expired or does not belong to this agent.' }, 409)
        lease = data
      } else {
        const existing = await getActiveLease(ticket.id)
        if (existing) return json({ error: `Ticket already leased to ${existing.agent_role}`, execution_id: existing.execution_id, lease_until: existing.lease_until }, 409)
        const leaseUntil = new Date(Date.now() + 30 * 60_000).toISOString()
        const { data, error } = await service.from('orchestrator_leases').insert({ ticket_id: ticket.id, agent_id: agent.id, agent_role: agent.role, lease_until: leaseUntil, metadata: { selected_by: 'agent-gateway-manual-claim' } }).select('*').single()
        if (error) {
          if (error.code === '23505') return json({ error: 'Ticket was leased concurrently; retry.' }, 409)
          throw error
        }
        lease = data
      }

      if ((agent.role === 'Planner' || agent.role === 'Builder') && ticket.status === 'Ready') await service.from('tickets').update({ status: 'In Progress' }).eq('id', ticket.id)
      await service.from('agent_runs').update({ status: 'active', started_at: new Date().toISOString(), agent_id: agent.id }).eq('ticket_id', ticket.id).eq('role', agent.role)
      await service.from('ticket_activity').insert({ ticket_id: ticket.id, actor_name: agent.name, actor_type: 'agent', action: `${agent.role} claimed ticket (execution ${lease.execution_id})` })
      const { data: fresh } = await service.from('tickets').select('*').eq('id', ticket.id).single()
      return json({ ...(await bundle(fresh)), guard: gates, execution_id: lease.execution_id })
    }

    if (action === 'heartbeat') {
      const executionId = String(body?.execution_id ?? '')
      if (!executionId) return json({ error: 'execution_id is required' }, 400)
      const extendMinutes = Math.max(5, Math.min(60, Number(body?.extend_minutes ?? 30)))
      const { data: lease } = await service.from('orchestrator_leases').select('*').eq('execution_id', executionId).eq('agent_id', agent.id).eq('agent_role', agent.role).eq('status', 'active').maybeSingle()
      if (!lease) return json({ error: 'Active lease not found for this agent/execution.' }, 404)
      if (Date.parse(lease.lease_until) <= Date.now()) {
        await service.from('orchestrator_leases').update({ status: 'expired', released_at: new Date().toISOString(), release_reason: 'Heartbeat arrived after expiry' }).eq('id', lease.id)
        return json({ error: 'Lease expired.' }, 409)
      }
      const now = new Date(), leaseUntil = new Date(now.getTime() + extendMinutes * 60_000)
      const { data, error } = await service.from('orchestrator_leases').update({ heartbeat_at: now.toISOString(), lease_until: leaseUntil.toISOString() }).eq('id', lease.id).select('*').single()
      if (error) throw error
      return json({ lease: data })
    }

    if (action === 'decision_request') {
      const ticket = await resolveTicket()
      if (!ticket) return json({ error: 'Ticket not found for this project' }, 404)
      const title = String(body?.title ?? '').trim(), question = String(body?.question ?? '').trim()
      if (!title || !question) return json({ error: 'title and question are required' }, 400)
      const { data, error } = await service.from('decision_requests').insert({ project_id: credential.project_id, ticket_id: ticket.id, requested_by_agent_id: agent.id, title, context: String(body?.context ?? ''), question, options: Array.isArray(body?.options) ? body.options : [] }).select('*').single()
      if (error) throw error
      await service.from('ticket_comments').insert({ ticket_id: ticket.id, author_name: agent.name, author_type: 'agent', body: `Decision request created: ${title}\n\n${question}` })
      return json({ decision_request: data }, 201)
    }

    if (action === 'handoff') {
      const ticket = await resolveTicket()
      if (!ticket) return json({ error: 'Ticket not found for this project' }, 404)
      if (ticket.assigned_agent !== agent.role) return json({ error: `Ticket is assigned to ${ticket.assigned_agent ?? 'nobody'}, not ${agent.role}` }, 409)
      const activeLease = await getActiveLease(ticket.id)
      if (activeLease) {
        const executionId = String(body?.execution_id ?? '')
        if (!executionId || executionId !== activeLease.execution_id || activeLease.agent_id !== agent.id) return json({ error: 'handoff requires the active execution_id owned by this agent.' }, 409)
      }
      const result = String(body?.result ?? '').toUpperCase()
      if (!['PASS', 'FAIL', 'BLOCKED', 'CHANGES_REQUESTED'].includes(result)) return json({ error: 'Invalid handoff result' }, 400)
      const note = String(body?.note ?? ''), report = String(body?.report ?? '')
      const runStatus = result === 'PASS' ? 'passed' : result === 'BLOCKED' ? 'active' : 'failed'
      await service.from('agent_runs').update({ status: runStatus, note, report, completed_at: result === 'BLOCKED' ? null : new Date().toISOString(), agent_id: agent.id }).eq('ticket_id', ticket.id).eq('role', agent.role)
      await service.from('ticket_comments').insert({ ticket_id: ticket.id, author_name: agent.name, author_type: 'agent', body: `### ${agent.role} Report\n\n**Result:** ${result}\n\n${report || note || 'No additional details.'}` })

      let nextStatus = ticket.status, nextAgent: string | null = agent.role
      if (result === 'PASS') {
        if (agent.role === 'Planner') { nextStatus = 'Ready'; nextAgent = 'Builder' }
        else if (agent.role === 'Builder') { nextStatus = 'Review'; nextAgent = 'Reviewer' }
        else if (agent.role === 'Reviewer') { nextStatus = 'QA'; nextAgent = 'QA' }
        else if (agent.role === 'QA') { nextStatus = 'QA'; nextAgent = 'Browser' }
        else if (agent.role === 'Browser') { nextStatus = 'Ready to Release'; nextAgent = 'Release' }
        else if (agent.role === 'Release') { nextStatus = 'Done'; nextAgent = null }
      } else if (result === 'FAIL' || result === 'CHANGES_REQUESTED') {
        if (['Reviewer', 'QA', 'Browser', 'Builder'].includes(agent.role)) { nextStatus = 'In Progress'; nextAgent = 'Builder' }
      }
      if (result !== 'BLOCKED') await service.from('tickets').update({ status: nextStatus, assigned_agent: nextAgent }).eq('id', ticket.id)
      if (activeLease) await service.from('orchestrator_leases').update({ status: 'released', released_at: new Date().toISOString(), release_reason: `Handoff ${result}` }).eq('id', activeLease.id)
      await service.from('ticket_activity').insert({ ticket_id: ticket.id, actor_name: agent.name, actor_type: 'agent', action: `${agent.role} handoff: ${result}${result === 'BLOCKED' ? '' : ` -> ${nextAgent ?? 'closed'}`}` })
      const { data: fresh } = await service.from('tickets').select('*').eq('id', ticket.id).single()
      return json(await bundle(fresh))
    }

    if (action === 'release_lease') {
      const executionId = String(body?.execution_id ?? '')
      if (!executionId) return json({ error: 'execution_id is required' }, 400)
      const { data: lease } = await service.from('orchestrator_leases').select('*').eq('execution_id', executionId).eq('agent_id', agent.id).eq('status', 'active').maybeSingle()
      if (!lease) return json({ error: 'Active lease not found.' }, 404)
      const { error } = await service.from('orchestrator_leases').update({ status: 'cancelled', released_at: new Date().toISOString(), release_reason: String(body?.reason ?? 'Released by agent') }).eq('id', lease.id)
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
