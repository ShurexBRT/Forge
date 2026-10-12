import { fetchPreview, localChecks, PreflightError, readConfig, redact } from './preflight.ts'
import { createAgentAuthorizer, createAuthenticator, startConnect } from './connect.ts'
import { loadCredential } from './credentials.ts'
import { join } from 'node:path'
import { Gateway } from './gateway.ts'
import { openJournal } from './journal.ts'
import { executeTicket } from './execution.ts'
import { prepareWorker } from './worker.ts'

const args = process.argv.slice(2)
const command = args[0] || 'help'
const asJson = args.includes('--json')
const help = `Forge runner\n\nCommands:\n  doctor [--json]      Check repository and Codex authentication\n  preview [--json]     Read server-selected work and blockers\n  connect             Local user login and read-only preview\n  inspect ORC-N       Read ticket context with FORGE_AGENT_TOKEN\n  run ORC-N           Claim one Builder ticket, implement, check and create a draft PR\n\nRun from the repository root with Node >=22.18.\nSee orchestrator/runner/README.md for credentials and recovery.\n`
function print(value: unknown) {
  console.log(redact(typeof value === 'string' ? value : JSON.stringify(value, null, 2), process.env))
}

try {
  if (['help', '--help', '-h'].includes(command)) print(`${help}\n  authorize QA|Builder  Grant and encrypt a project/role credential through local login\n`)
  else {
    const ticketCommand = ['inspect', 'run'].includes(command)
    const authorize = command === 'authorize'
    if (!['doctor', 'preview', 'connect', 'inspect', 'run', 'authorize'].includes(command)
      || (ticketCommand || authorize ? args.length !== 2 : args.slice(1).some(arg => arg !== '--json')) || (command === 'connect' && asJson)
      || (authorize && !['Builder', 'QA'].includes(args[1]))) {
      throw new PreflightError('Unknown command or option. Use help.')
    }
    const config = readConfig(process.env, process.cwd())
    const checks = await localChecks(config)
    if (ticketCommand) {
      if (!checks.find(c => c.name === 'repository')?.ok) throw new PreflightError('Repository check failed.')
      const role = command === 'run' ? 'Builder' : (process.env.FORGE_AGENT_ROLE || 'Builder')
      if (role !== 'Builder' && role !== 'QA') throw new PreflightError('FORGE_AGENT_ROLE must be Builder or QA.')
      const gateway = new Gateway(config, process.env.FORGE_AGENT_TOKEN || await loadCredential(config, role))
      gateway.validateKey(args[1])
      if (command === 'inspect') {
        const context = await gateway.getTicket(args[1])
        print({ ticket: context.ticket, agent: context.agent, criteria: context.criteria, guard: context.guard, activeLease: context.active_lease, runtimeBlocker: context.active_runtime_blocker })
      } else {
        if (checks.some(c => !c.ok)) throw new PreflightError('All local checks must pass before execution.')
        const controller = new AbortController()
        const stop = () => controller.abort()
        process.once('SIGINT', stop); process.once('SIGTERM', stop)
        const directory = join(config.repoPath, '.forge-runner')
        try {
          // Verify local tools and repository configuration before claiming anything.
          const work = await prepareWorker(config, directory, controller.signal)
          const journal = await openJournal(directory, args[1])
          try {
            print(`Starting ${args[1]}. Journal: ${journal.path}. Ctrl+C stops this execution.`)
            const result = await executeTicket(args[1], { gateway, work, save: patch => journal.save(patch) }, controller.signal)
            print({ result: 'review_pending', pullRequest: result.pullRequest, worktree: result.worktree })
          } finally { await journal.close() }
        } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop) }
      }
    } else if (command === 'doctor') {
      const result = { mode: 'read-only', project: config.project, checks, executionEnabled: false }
      print(asJson ? result : checks.map(c => `${c.ok ? 'OK' : 'BLOCKED'} ${c.name}: ${c.detail}`).join('\n'))
      if (checks.some(c => !c.ok)) process.exitCode = 1
    } else {
      if (!checks.find(c => c.name === 'repository')?.ok) throw new PreflightError('Repository check failed. Run doctor first.')
      let preview
      if (command === 'connect' || authorize) {
        const role = authorize ? args[1] as 'Builder' | 'QA' : undefined
        const connection = await startConnect(config, role ? createAgentAuthorizer(config, role) : createAuthenticator(config, process.env), {
          port: 6910,
          timeoutMs: 60 * 60_000,
          role,
          onRejected: reason => print(`Local browser request rejected: ${reason}`),
        })
        const cancel = () => connection.close()
        process.once('SIGINT', cancel)
        process.once('SIGTERM', cancel)
        print(`Prijavi se lokalno: ${connection.url}\nStranica važi 60 minuta. Lozinku unesi samo u lokalnu formu, nikada u chat.`)
        preview = await connection.done
        process.removeListener('SIGINT', cancel)
        process.removeListener('SIGTERM', cancel)
        if (!preview) throw new PreflightError('Povezivanje je otkazano ili je istekao rok. Pokreni connect ponovo.')
        if (role) print(`${role} credential saved with Windows user encryption. No ticket was started.`)
      } else preview = await fetchPreview(config, process.env)
      const result = { mode: 'read-only', project: config.project, checks, executionEnabled: false, ...preview }
      print(asJson ? result : [
        `Forge ${config.project} — read-only preview (execution disabled)`,
        ...checks.filter(c => !c.ok).map(c => `WARNING ${c.name}: ${c.detail}`),
        `Selected: ${preview.selected?.ticket_key ?? 'none'}`,
        ...preview.evaluations.map(row => `${row.eligible ? 'ELIGIBLE' : 'BLOCKED'} ${row.ticket_key} [${row.required_role ?? 'unassigned'}] ${row.title}\n${[...row.blockers, ...row.warnings].map(reason => `  - ${reason}`).join('\n')}`),
      ].join('\n'))
    }
  }
} catch (error) {
  const message = error instanceof PreflightError ? error.message : 'Local preflight failed. Check configuration and runtime.'
  print(asJson ? { error: message, executionEnabled: false } : `ERROR: ${message}`)
  process.exitCode = 1
}
