import { PreflightError } from './preflight.ts'
import type { Config } from './preflight.ts'
import type { WorkerResult } from './execution.ts'

export class GatewayError extends PreflightError {
  status: number | null
  uncertain: boolean
  constructor(message: string, status: number | null, uncertain = false) {
    super(message); this.status = status; this.uncertain = uncertain
  }
}
export type Lease = { execution_id: string; agent_id: string; agent_role: string; status: string; lease_until: string }
export type TicketBundle = {
  ticket: { id: string; project_id: string; ticket_number: number; title: string; description: string; status: string; assigned_agent: string }
  project: { id: string; key: string }
  agent: { id: string; role: string }
  criteria: Array<{ text: string }>
  comments: unknown[]; agent_runs: unknown[]; dependencies: Array<{ status: string }>
  project_direction: { status: string } | null
  open_decisions: unknown[]
  active_lease: Lease | null
  active_runtime_blocker: unknown
  guard: { blockers: string[]; warnings: string[]; direction_status: string }
  execution_id?: string
}
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)

export function parseLease(value: unknown): Lease {
  if (!isRecord(value) || !isUuid(value.execution_id) || !isUuid(value.agent_id) || typeof value.agent_role !== 'string'
    || typeof value.status !== 'string' || typeof value.lease_until !== 'string' || !Number.isFinite(Date.parse(value.lease_until))) {
    throw new GatewayError('Gateway returned an invalid lease.', null, true)
  }
  return value as Lease
}

export function parseBundle(value: unknown, config: Config, ticketKey: string): TicketBundle {
  const bad = () => new GatewayError('Gateway returned incomplete or out-of-project ticket context.', null)
  if (!isRecord(value) || !isRecord(value.ticket) || !isRecord(value.project) || !isRecord(value.agent) || !isRecord(value.guard)) throw bad()
  const { ticket, project, agent, guard } = value
  if (project.key !== config.project || !isUuid(project.id) || ticket.project_id !== project.id || !isUuid(ticket.id)
    || `${project.key}-${ticket.ticket_number}` !== ticketKey || !Number.isInteger(ticket.ticket_number)
    || !['title', 'description', 'status', 'assigned_agent'].every(k => typeof ticket[k] === 'string')
    || !isUuid(agent.id) || typeof agent.role !== 'string'
    || !['criteria', 'comments', 'agent_runs', 'dependencies', 'open_decisions'].every(k => Array.isArray(value[k]))
    || !(value.criteria as unknown[]).every(c => isRecord(c) && typeof c.text === 'string')
    || !(value.dependencies as unknown[]).every(d => isRecord(d) && typeof d.status === 'string')
    || !Array.isArray(guard.blockers) || !guard.blockers.every(v => typeof v === 'string')
    || !Array.isArray(guard.warnings) || !guard.warnings.every(v => typeof v === 'string')
    || typeof guard.direction_status !== 'string' || !('active_lease' in value) || !('active_runtime_blocker' in value)
    || !(value.project_direction === null || (isRecord(value.project_direction) && typeof value.project_direction.status === 'string'))) throw bad()
  if (value.active_lease !== null) parseLease(value.active_lease)
  return value as unknown as TicketBundle
}

export function assertBuilderReady(bundle: TicketBundle) {
  if (bundle.agent.role !== 'Builder' || bundle.ticket.assigned_agent !== 'Builder') throw new PreflightError('This runner executes only Builder tickets with a Builder credential.')
  if (!['Ready', 'In Progress'].includes(bundle.ticket.status)) throw new PreflightError('Ticket is not in a Builder stage.')
  if (bundle.guard.blockers.length || bundle.active_runtime_blocker || bundle.dependencies.some(d => d.status !== 'Done')
    || bundle.guard.direction_status !== 'defined' || bundle.project_direction?.status !== 'defined') throw new PreflightError('Ticket is blocked; resolve its recorded blockers before execution.')
  if (!bundle.criteria.length || !bundle.ticket.description.trim()) throw new PreflightError('Ticket needs a description and acceptance criteria before execution.')
}

export class Gateway {
  config: Config
  #token: string
  #request: typeof fetch
  constructor(config: Config, token: string | undefined, request: typeof fetch = fetch) {
    if (!token?.trim() || /[\r\n]/.test(token)) throw new PreflightError('Configure FORGE_AGENT_TOKEN for the project and role. Never paste it into chat.')
    this.config = config; this.#token = token.trim(); this.#request = request
  }
  async call(action: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const mutation = !['get_ticket', 'next_ticket'].includes(action)
    try {
      const response = await this.#request(`${this.config.url}/functions/v1/agent-gateway`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/json', 'x-forge-agent-token': this.#token },
        body: JSON.stringify({ ...body, action }),
      })
      if (!response.ok) throw new GatewayError(`Gateway ${action} failed (HTTP ${response.status}).`, response.status, mutation && response.status >= 500)
      return await response.json()
    } catch (error) {
      if (error instanceof GatewayError) throw error
      throw new GatewayError(`Gateway ${action} response unavailable; ${mutation ? 'reconcile before retrying' : 'check connectivity'}.`, null, mutation)
    }
  }
  validateKey(key: string) {
    if (!key.startsWith(`${this.config.project}-`) || !/^\d+$/.test(key.slice(this.config.project.length + 1))) throw new PreflightError('Ticket must belong to the configured project.')
  }
  async getTicket(key: string) {
    this.validateKey(key)
    return parseBundle(await this.call('get_ticket', { ticket_key: key }), this.config, key)
  }
  async claim(key: string) {
    this.validateKey(key)
    const raw = await this.call('claim', { ticket_key: key })
    try {
      const bundle = parseBundle(raw, this.config, key)
      const lease = bundle.active_lease
      if (!lease || !isUuid(bundle.execution_id) || bundle.execution_id !== lease.execution_id || lease.agent_id !== bundle.agent.id
        || lease.agent_role !== bundle.agent.role || lease.status !== 'active' || Date.parse(lease.lease_until) <= Date.now()) throw new Error()
      return bundle
    } catch { throw new GatewayError('Claim response could not be verified; reconcile before retrying.', null, true) }
  }
  async heartbeat(executionId: string) {
    if (!isUuid(executionId)) throw new PreflightError('Invalid execution ID.')
    const value = await this.call('heartbeat', { execution_id: executionId, extend_minutes: 30 })
    return parseLease(isRecord(value) ? value.lease : null)
  }
  async release(executionId: string, reason: string) {
    if (!isUuid(executionId)) throw new PreflightError('Invalid execution ID.')
    const result = await this.call('release_lease', { execution_id: executionId, reason })
    if (!isRecord(result) || result.ok !== true) throw new GatewayError('Lease release could not be verified.', null, true)
  }
  async handoff(key: string, executionId: string, result: WorkerResult) {
    this.validateKey(key)
    if (!isUuid(executionId)) throw new PreflightError('Invalid execution ID.')
    const report = `Result: PASS\nExecution: ${executionId}\nBranch: ${result.branch}\nCommit: ${result.commit}\nPR: ${result.pullRequest}\n${result.report}\nNext owner: Reviewer. Independent review and QA are not complete.`
    await this.call('handoff', { ticket_key: key, execution_id: executionId, result: 'PASS', note: 'Builder implementation and checks completed; PR awaits review.', report })
    const fresh = await this.getTicket(key)
    if (fresh.ticket.status !== 'Review' || fresh.ticket.assigned_agent !== 'Reviewer' || fresh.active_lease !== null
      || !fresh.agent_runs.some(run => isRecord(run) && run.role === 'Builder' && run.status === 'passed' && run.report === report)) {
      throw new GatewayError('Handoff postconditions were not confirmed. Reconcile ticket and execution before retrying.', null, true)
    }
  }
}
