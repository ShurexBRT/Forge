import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PreflightError } from './preflight.ts'

export type RunState = 'claiming' | 'claimed' | 'working' | 'verified' | 'pr_created' | 'review_pending' | 'stopped' | 'needs_reconciliation'
export type RunRecord = { ticket: string; runId: string; state: RunState; updatedAt: string; executionId?: string; branch?: string; worktree?: string; commit?: string; pullRequest?: string; detail?: string }

export async function openJournal(directory: string, ticket: string) {
  if (!/^[A-Z][A-Z0-9_-]*-\d+$/.test(ticket)) throw new PreflightError('Invalid journal ticket key.')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const lockPath = join(directory, 'runner.lock')
  let lock
  try { lock = await open(lockPath, 'wx', 0o600) }
  catch { throw new PreflightError('Another runner or an interrupted run holds runner.lock. Inspect and reconcile before removing it.') }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, ticket, startedAt: new Date().toISOString() }))
    await lock.sync()
    const path = join(directory, `${ticket}.json`)
    try {
      await readFile(path, 'utf8')
      throw new PreflightError('A journal already exists for this ticket. Reconcile its worktree, PR and Forge state before a new attempt.')
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    let current: RunRecord = { ticket, runId: randomUUID(), state: 'claiming', updatedAt: new Date().toISOString() }
    async function save(patch: Partial<Omit<RunRecord, 'ticket' | 'runId'>>) {
      current = { ...current, ...patch, updatedAt: new Date().toISOString() }
      const tmp = `${path}.${current.runId}.tmp`
      const file = await open(tmp, 'w', 0o600)
      try { await file.writeFile(JSON.stringify(current, null, 2)); await file.sync() } finally { await file.close() }
      await rename(tmp, path)
      return current
    }
    await save({})
    return { path, current: () => current, save, close: async () => { await lock.close(); await rm(lockPath) } }
  } catch (error) { await lock.close(); await rm(lockPath); throw error }
}
