import { fetchPreview, localChecks, PreflightError, readConfig, redact } from './preflight.ts'
import { createAuthenticator, startConnect } from './connect.ts'

const args = process.argv.slice(2)
const command = args[0] || 'help'
const asJson = args.includes('--json')
const help = `Forge runner — read-only preflight\n\nCommands:\n  doctor [--json]   Check repository and local Codex authentication\n  preview [--json]  Show server-selected work and blockers; never claim tickets\n  connect          Open a local login page and preview tickets without copying tokens\n\nRun from the repository root with Node >=22.18:\n  node orchestrator/runner/cli.ts doctor\n  node orchestrator/runner/cli.ts connect\n  node --env-file=.env.runner.local orchestrator/runner/cli.ts preview\n\nSee orchestrator/runner/README.md for configuration.\n`
function print(value: unknown) {
  console.log(redact(typeof value === 'string' ? value : JSON.stringify(value, null, 2), process.env))
}

try {
  if (['help', '--help', '-h'].includes(command)) print(help)
  else {
    if (!['doctor', 'preview', 'connect'].includes(command) || args.slice(1).some(arg => arg !== '--json') || (command === 'connect' && asJson)) {
      throw new PreflightError('Unknown command or option. Use help. No execution commands are available.')
    }
    const config = readConfig(process.env, process.cwd())
    const checks = await localChecks(config)
    if (command === 'doctor') {
      const result = { mode: 'read-only', project: config.project, checks, executionEnabled: false }
      print(asJson ? result : checks.map(c => `${c.ok ? 'OK' : 'BLOCKED'} ${c.name}: ${c.detail}`).join('\n'))
      if (checks.some(c => !c.ok)) process.exitCode = 1
    } else {
      if (!checks.find(c => c.name === 'repository')?.ok) throw new PreflightError('Repository check failed. Run doctor first.')
      let preview
      if (command === 'connect') {
        const connection = await startConnect(config, createAuthenticator(config, process.env), {
          port: 6910,
          timeoutMs: 60 * 60_000,
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
