import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Gateway, GatewayError, parseBundle } from '../orchestrator/runner/gateway'
import type { TicketBundle } from '../orchestrator/runner/gateway'
import { readConfig } from '../orchestrator/runner/preflight'
import { executeTicket } from '../orchestrator/runner/execution'
import { openJournal } from '../orchestrator/runner/journal'
import { runProcess, workerEnvironment } from '../orchestrator/runner/process'
import { loadCredential, saveCredential } from '../orchestrator/runner/credentials'

const id = '11111111-1111-4111-8111-111111111111'
const executionId = '22222222-2222-4222-8222-222222222222'
const config = readConfig({}, process.cwd())
function context(): TicketBundle {
  return {
    ticket: { id, project_id: id, ticket_number: 34, title: 'Implement', description: 'Make the approved change', assigned_agent: 'Builder', status: 'In Progress' },
    project: { id, key: 'ORC' }, agent: { id, role: 'Builder' }, criteria: [{ text: 'Verified behavior' }], comments: [], agent_runs: [], dependencies: [],
    project_direction: { status: 'defined' }, open_decisions: [], active_lease: null, active_runtime_blocker: null,
    guard: { blockers: [], warnings: [], direction_status: 'defined' },
  }
}
function setup() {
  const initial = context()
  const lease = { execution_id: executionId, agent_id: id, agent_role: 'Builder', status: 'active', lease_until: new Date(Date.now() + 1800000).toISOString() }
  const claimed = { ...initial, active_lease: lease, execution_id: executionId }
  const gateway = {
    getTicket: vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(claimed),
    claim: vi.fn().mockResolvedValue(claimed), heartbeat: vi.fn().mockResolvedValue(lease), handoff: vi.fn().mockResolvedValue(undefined),
  }
  const save = vi.fn().mockResolvedValue(undefined)
  const result = { branch: 'codex/test', worktree: '/tmp/test', commit: 'abc', pullRequest: 'https://github.com/ShurexBRT/Forge/pull/3', report: 'Checks passed' }
  const work = vi.fn().mockResolvedValue(result)
  return { gateway, save, work, initial, claimed, result }
}
describe('single-ticket execution', () => {
  it('claims, verifies current ownership and hands off to review in order', async () => {
    const ports = setup()
    await expect(executeTicket('ORC-34', ports, new AbortController().signal)).resolves.toEqual(ports.result)
    expect(ports.save.mock.calls.map(([patch]) => patch.state)).toEqual(['claiming', 'claimed', 'working', 'pr_created', 'review_pending'])
    expect(ports.gateway.handoff).toHaveBeenCalledWith('ORC-34', executionId, ports.result)
  })
  it('does not claim a blocked ticket', async () => {
    const ports = setup(); ports.initial.guard.blockers.push('Runtime blocker')
    await expect(executeTicket('ORC-34', ports, new AbortController().signal)).rejects.toThrow('blocked')
    expect(ports.gateway.claim).not.toHaveBeenCalled(); expect(ports.work).not.toHaveBeenCalled()
  })
  it('records uncertain claims without retrying or starting a worker', async () => {
    const ports = setup(); ports.gateway.claim.mockRejectedValue(new GatewayError('timeout', null, true))
    await expect(executeTicket('ORC-34', ports, new AbortController().signal)).rejects.toThrow()
    expect(ports.gateway.claim).toHaveBeenCalledTimes(1)
    expect(ports.work).not.toHaveBeenCalled()
    expect(ports.save).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'needs_reconciliation' }))
  })
  it('stops the worker on heartbeat loss and never hands off', async () => {
    const ports = setup(); ports.gateway.heartbeat.mockRejectedValue(new Error('lost lease'))
    ports.work.mockImplementation((_bundle, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('stopped')), { once: true })
    }))
    await expect(executeTicket('ORC-34', ports, new AbortController().signal, 10)).rejects.toThrow('stopped')
    expect(ports.gateway.handoff).not.toHaveBeenCalled()
  })
  it('preserves the PR when handoff response is lost', async () => {
    const ports = setup(); ports.gateway.handoff.mockRejectedValue(new GatewayError('timeout', null, true))
    await expect(executeTicket('ORC-34', ports, new AbortController().signal)).rejects.toThrow()
    expect(ports.save).toHaveBeenCalledWith(expect.objectContaining({ state: 'pr_created', pullRequest: ports.result.pullRequest }))
    expect(ports.gateway.handoff).toHaveBeenCalledTimes(1)
    expect(ports.save).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'needs_reconciliation' }))
  })
  it('stops before handoff if ticket is blocked while the worker is running', async () => {
    const ports = setup()
    ports.gateway.getTicket.mockReset().mockResolvedValueOnce(ports.initial).mockResolvedValue({ ...ports.claimed, active_runtime_blocker: { reason: 'stop' } })
    await expect(executeTicket('ORC-34', ports, new AbortController().signal)).rejects.toThrow('blocked')
    expect(ports.gateway.handoff).not.toHaveBeenCalled()
  })
})

describe('gateway and recovery boundaries', () => {
  it.skipIf(process.platform !== 'win32')('stores only encrypted credentials and decrypts for the current Windows user', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forge-credential-'))
    const localConfig = { ...config, repoPath: directory }
    try {
      expect(await loadCredential(localConfig, 'QA')).toBeUndefined()
      await saveCredential(localConfig, 'QA', 'fixture-agent-secret', id)
      const stored = await readFile(join(directory, '.forge-runner/credentials/ORC-QA.json'), 'utf8')
      expect(stored).not.toContain('fixture-agent-secret')
      expect(await loadCredential(localConfig, 'QA')).toBe('fixture-agent-secret')
      await expect(saveCredential(localConfig, 'QA', 'replacement', id)).rejects.toThrow()
      await expect(loadCredential({ ...localConfig, url: 'https://other.example' }, 'QA')).rejects.toThrow('does not match')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('rejects out-of-project context', () => {
    expect(() => parseBundle({ ...context(), project: { id, key: 'OTHER' } }, config, 'ORC-34')).toThrow()
  })
  it('treats a lost mutation response as uncertain, without leaking request details', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret-token'))
    const gateway = new Gateway(config, 'secret-token', fetcher)
    await expect(gateway.claim('ORC-34')).rejects.toMatchObject({ uncertain: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('refuses duplicate runners and retains durable state after closing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forge-journal-'))
    try {
      const journal = await openJournal(directory, 'ORC-34')
      try {
        await expect(openJournal(directory, 'ORC-35')).rejects.toThrow('runner.lock')
        await journal.save({ state: 'needs_reconciliation', executionId })
      } finally { await journal.close() }
      expect(JSON.parse(await readFile(join(directory, 'ORC-34.json'), 'utf8')).executionId).toBe(executionId)
      await expect(openJournal(directory, 'ORC-34')).rejects.toThrow('already exists')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('removes Forge, GitHub and API credentials from the child environment', () => {
    expect(workerEnvironment({ PATH: 'bin', FORGE_AGENT_TOKEN: 'secret', GH_TOKEN: 'secret', OPENAI_API_KEY: 'secret' })).toEqual({ PATH: 'bin' })
  })
  it('terminates an actual long-running local child on cancellation', async () => {
    const controller = new AbortController()
    const result = runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], process.cwd(), controller.signal)
    setTimeout(() => controller.abort(), 100)
    await expect(result).rejects.toThrow('stopped')
  })
})
