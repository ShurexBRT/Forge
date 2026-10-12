import { assertBuilderReady, GatewayError } from './gateway.ts'
import type { Lease, TicketBundle } from './gateway.ts'
import { PreflightError } from './preflight.ts'
import type { RunRecord } from './journal.ts'

export type WorkerResult = { branch: string; worktree: string; commit: string; pullRequest: string; report: string }
export type ExecutionPorts = {
  gateway: {
    getTicket(key: string): Promise<TicketBundle>
    claim(key: string): Promise<TicketBundle>
    heartbeat(id: string): Promise<Lease>
    handoff(key: string, id: string, result: WorkerResult): Promise<void>
  }
  save(patch: Partial<RunRecord>): Promise<unknown>
  work(bundle: TicketBundle, signal: AbortSignal, save: ExecutionPorts['save']): Promise<WorkerResult>
}

// A conservative first runner: no automatic retries or lease release on ambiguous
// outcomes. Its journal blocks redispatch locally until explicit reconciliation.
export async function executeTicket(key: string, ports: ExecutionPorts, signal: AbortSignal, heartbeatMs = 60_000) {
  const initial = await ports.gateway.getTicket(key)
  assertBuilderReady(initial)
  if (initial.active_lease) throw new PreflightError('Ticket already has a lease. Inspect it before starting another execution.')
  signal.throwIfAborted()
  await ports.save({ state: 'claiming' })
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  let interval: ReturnType<typeof setInterval> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let heartbeat: Promise<void> | null = null
  let heartbeatFailed = false
  try {
    const claimed = await ports.gateway.claim(key)
    const lease = claimed.active_lease!
    assertBuilderReady(claimed)
    if (claimed.agent.id !== initial.agent.id || claimed.ticket.id !== initial.ticket.id) throw new PreflightError('Claim changed agent or ticket identity.')
    if (signal.aborted) controller.abort()
    await ports.save({ state: 'claimed', executionId: lease.execution_id })
    const armDeadline = (current: Lease) => {
      if (current.execution_id !== lease.execution_id || current.agent_id !== lease.agent_id || current.agent_role !== 'Builder'
        || current.status !== 'active' || Date.parse(current.lease_until) <= Date.now() + 30_000) throw new PreflightError('Lease ownership or deadline is no longer valid.')
      clearTimeout(deadline)
      deadline = setTimeout(() => controller.abort(), Date.parse(current.lease_until) - Date.now() - 30_000)
    }
    armDeadline(lease)
    interval = setInterval(() => {
      if (heartbeat || controller.signal.aborted) return
      heartbeat = ports.gateway.heartbeat(lease.execution_id).then(armDeadline).catch(() => {
        heartbeatFailed = true; controller.abort()
      }).finally(() => { heartbeat = null })
    }, heartbeatMs)
    controller.signal.throwIfAborted()
    await ports.save({ state: 'working' })
    const result = await ports.work(claimed, controller.signal, ports.save)
    controller.signal.throwIfAborted()
    // Quiesce heartbeats before final ownership check and handoff.
    clearInterval(interval)
    if (heartbeat) await heartbeat
    if (heartbeatFailed) throw new PreflightError('Heartbeat failed; worker result requires reconciliation.')
    controller.signal.throwIfAborted()
    armDeadline(await ports.gateway.heartbeat(lease.execution_id))
    const fresh = await ports.gateway.getTicket(key)
    assertBuilderReady(fresh)
    if (fresh.active_lease?.execution_id !== lease.execution_id || fresh.agent.id !== lease.agent_id) throw new PreflightError('Lease ownership changed before handoff.')
    await ports.save({ state: 'pr_created', branch: result.branch, worktree: result.worktree, commit: result.commit, pullRequest: result.pullRequest })
    controller.signal.throwIfAborted()
    await ports.gateway.handoff(key, lease.execution_id, result)
    await ports.save({ state: 'review_pending', detail: 'Builder evidence submitted; independent review and QA remain required.' })
    return result
  } catch (error) {
    controller.abort()
    await ports.save({ state: 'needs_reconciliation', detail: error instanceof GatewayError && error.uncertain ? 'A remote mutation may have succeeded. Read Forge state before retrying.' : 'Execution stopped. Inspect lease, worktree and any PR before retrying.' })
    throw error
  } finally {
    clearInterval(interval); clearTimeout(deadline)
    signal.removeEventListener('abort', cancel)
    if (heartbeat) await heartbeat
  }
}
