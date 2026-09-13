import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
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
    const leaseMinutes = Math.max(5, Math.min(120, Number(body?.lease_minutes ?? 30)))
    const selectorResponse = await fetch(`${url}/functions/v1/orchestrator-dry-run`, {
      method: 'POST',
      headers: { Authorization: authHeader, apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_key: body?.project_key ?? undefined }),
    })
    const selector = await selectorResponse.json()
    if (!selectorResponse.ok) return json({ error: 'Selector failed', selector }, selectorResponse.status)
    const selected = selector?.selected
    if (!selected) return json({ dispatched: false, reason: 'No eligible ticket', selector })
    if (!selected.agent_id || !selected.required_role) return json({ error: 'Selected ticket has no enabled agent identity', selected }, 409)

    const now = new Date()
    await service
      .from('orchestrator_leases')
      .update({ status: 'expired', released_at: now.toISOString(), release_reason: 'Expired before a new dispatch attempt' })
      .eq('ticket_id', selected.ticket_id)
      .eq('status', 'active')
      .lte('lease_until', now.toISOString())

    const leaseUntil = new Date(now.getTime() + leaseMinutes * 60_000)
    const { data: lease, error: leaseError } = await service
      .from('orchestrator_leases')
      .insert({
        ticket_id: selected.ticket_id,
        agent_id: selected.agent_id,
        agent_role: selected.required_role,
        lease_until: leaseUntil.toISOString(),
        metadata: {
          selected_by: 'orchestrator-dispatch',
          project_key: selected.project_key,
          ticket_key: selected.ticket_key,
          score: selected.score,
          warnings: selected.warnings ?? [],
        },
      })
      .select('id, ticket_id, agent_id, agent_role, execution_id, status, acquired_at, lease_until')
      .single()

    if (leaseError) {
      if (leaseError.code === '23505') return json({ dispatched: false, reason: 'Ticket was claimed concurrently; retry selection.', selected }, 409)
      throw leaseError
    }

    await service.from('ticket_activity').insert({
      ticket_id: selected.ticket_id,
      actor_name: 'Orchestrator',
      actor_type: 'system',
      action: `Dispatch lease reserved for ${selected.required_role} (execution ${lease.execution_id})`,
    })

    return json({
      dispatched: true,
      execution_id: lease.execution_id,
      lease,
      selected,
      next_step: 'Runner must call Agent Gateway claim with this execution_id before doing work.',
    }, 201)
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
