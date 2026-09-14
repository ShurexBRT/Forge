import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forge-agent-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const rawToken = req.headers.get('x-forge-agent-token')
    if (!rawToken) return json({ error: 'Missing x-forge-agent-token' }, 401)

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const tokenHash = await sha256(rawToken)
    const { data: credential, error: credentialError } = await service
      .from('agent_credentials')
      .select('id, project_id, agent_id, active, agents(id,name,role,status), projects(id,key,name,github_repo)')
      .eq('token_hash', tokenHash)
      .eq('active', true)
      .maybeSingle()

    if (credentialError) throw credentialError
    if (!credential) return json({ error: 'Invalid or revoked agent token' }, 401)

    const agent = credential.agents as any
    const project = credential.projects as any
    if (!agent || agent.status !== 'active') return json({ error: 'Agent is disabled' }, 403)

    const [{ data: assignment }, { data: binding }, { data: direction }] = await Promise.all([
      service.from('project_agents')
        .select('enabled,specialization,permissions')
        .eq('project_id', credential.project_id)
        .eq('agent_id', credential.agent_id)
        .maybeSingle(),
      service.from('project_context_bindings')
        .select('*')
        .eq('project_id', credential.project_id)
        .maybeSingle(),
      service.from('project_direction')
        .select('*')
        .eq('project_id', credential.project_id)
        .maybeSingle(),
    ])

    if (!assignment?.enabled) return json({ error: 'Agent is not enabled for this project' }, 403)

    await service.from('agent_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credential.id)

    return json({
      project,
      chatgpt_project: binding?.chatgpt_project_name ?? project?.name ?? null,
      context_version: binding?.context_version ?? null,
      repo_context_path: binding?.repo_context_path ?? null,
      source_of_truth: binding?.source_of_truth ?? null,
      escalation_path: binding?.escalation_path ?? 'Agent -> Orchestrator -> PM -> Owner',
      context_notes: binding?.notes ?? '',
      product_direction: direction ?? null,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        specialization: assignment.specialization,
        permissions: assignment.permissions,
      },
      execution_contract: {
        read_context_before_ticket: true,
        work_source: 'Forge tickets only',
        product_decisions: 'Escalate; never invent broad product direction',
      },
    })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500)
  }
})
